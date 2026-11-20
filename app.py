import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template
from flask_mysqldb import MySQL

load_dotenv(override=True)

# region conexion de base de datos
app = Flask(__name__)

# Conexion a la BD
app.config['MYSQL_HOST'] = os.environ['DB_HOST']
app.config['MYSQL_USER'] = os.environ['DB_USER']
app.config['MYSQL_PASSWORD'] = os.environ['DB_PASSWORD']
app.config['MYSQL_DB'] = os.environ['DB_NAME']
app.config['MYSQL_CURSORCLASS'] = 'DictCursor'

mysql = MySQL(app)
# endregion


# region Ruta de prueba API
@app.route('/api')
def inicio_api():
    try:
        cur = mysql.connection.cursor()
        cur.execute("SELECT 1")
        cur.close()
        return jsonify({"mensaje": "API Biblioteca funcionando"})
    except Exception:
        return jsonify({"mensaje": "El sistema no esta disponible"}), 500
# endregion


# region Ruta principal (/) -> Bienvenida
@app.route('/')
def inicio():
    api_activa = False
    try:
        cur = mysql.connection.cursor()
        cur.execute("SELECT 1")
        cur.close()
        api_activa = True
    except Exception:
        api_activa = False

    return render_template('inicio.html', ubicacion='Biblioteca', api_activa=api_activa)
# endregion


# region TODO de libros
@app.route('/api/libros/', methods=['GET'])
def listar_libros():
    cursor = mysql.connection.cursor()
    sql = "SELECT * FROM libros"
    cursor.execute(sql)
    libros = cursor.fetchall()
    cursor.close()
    return jsonify(libros)

@app.route('/libros')
def ver_libros():
    return render_template('libros.html', ubicacion='Ver todos los libros')

@app.route('/libros/buscar')
def buscar_libro():
    return render_template('buscar_libro.html', ubicacion='Buscar libro por ID')


# GET /api/libros/<id>
@app.route('/api/libros/<int:id>', methods=['GET'])
def listar_libro(id):
    cursor = mysql.connection.cursor()
    sql = "SELECT * FROM libros WHERE id = %s"
    cursor.execute(sql, (id,))
    libro = cursor.fetchone()
    cursor.close()

    if libro is None:
        return jsonify({"error": "Libro no encontrado"}), 404
    return jsonify(libro)


@app.route('/libros/registrar')
def registrar_libro():
    return render_template('registrar_libro.html', ubicacion='Registrar libro')


# POST /api/libros para registrar un libro
@app.route('/api/libros', methods=['POST'])
def api_registrar_libro():
    datos = request.get_json(silent=True) or {}

    titulo = datos.get('titulo')
    autor = datos.get('autor')
    stock = datos.get('stock')

    if not titulo or not autor or stock is None:
        return jsonify({"error": "Completa titulo, autor y stock"}), 400

    cursor = mysql.connection.cursor()
    sql = "INSERT INTO libros (titulo, autor, stock) VALUES (%s, %s, %s)"
    cursor.execute(sql, (titulo, autor, stock))
    mysql.connection.commit()
    cursor.close()

    return jsonify({"mensaje": "Libro registrado"}), 201


@app.route('/libros/modificar/<int:id>')
def modificar_libro(id):
    return render_template('modificar_libro.html', libro_id=id, ubicacion='Modificar libro')


# PATCH /api/libros/<id> para modificar un libro
@app.route('/api/libros/<int:id>', methods=['PATCH'])
def api_modificar_libro(id):
    datos = request.get_json(silent=True) or {}

    titulo = datos.get('titulo')
    autor = datos.get('autor')
    stock = datos.get('stock')

    if not titulo or not autor or stock is None:
        return jsonify({"error": "Completa titulo, autor y stock"}), 400

    cursor = mysql.connection.cursor()

    cursor.execute("SELECT id FROM libros WHERE id = %s", (id,))
    if cursor.fetchone() is None:
        cursor.close()
        return jsonify({"error": "Libro no encontrado"}), 404

    sql = "UPDATE libros SET titulo = %s, autor = %s, stock = %s WHERE id = %s"
    cursor.execute(sql, (titulo, autor, stock, id))
    mysql.connection.commit()
    cursor.close()

    return jsonify({"mensaje": "Libro actualizado correctamente"}), 200
# endregion


# region TODO de prestamos
@app.route('/api/prestamos', methods=['GET'])
def listar_prestamos():
    cursor = mysql.connection.cursor()
    sql = """SELECT p.id, p.libro_id, l.titulo AS libro, p.estudiante, p.fecha_prestamo, p.estado, p.fecha_devolucion
             FROM prestamos p
             INNER JOIN libros l ON l.id = p.libro_id
             ORDER BY p.id"""
    cursor.execute(sql)
    prestamos = cursor.fetchall()
    cursor.close()
    return jsonify(prestamos)


@app.route('/prestamos')
def ver_prestamos():
    return render_template('prestamos.html', ubicacion='Ver todos los préstamos')


@app.route('/prestamos/buscar')
def buscar_prestamo():
    return render_template('buscar_prestamo.html', ubicacion='Buscar préstamo')


# GET /api/prestamos/<id>
@app.route('/api/prestamos/<int:id>', methods=['GET'])
def listar_prestamo_por_id(id):
    cursor = mysql.connection.cursor()
    sql = """SELECT p.id, p.libro_id, l.titulo AS libro, p.estudiante, p.fecha_prestamo, p.estado, p.fecha_devolucion
             FROM prestamos p
             INNER JOIN libros l ON l.id = p.libro_id
             WHERE p.id = %s"""
    cursor.execute(sql, (id,))
    prestamo = cursor.fetchone()
    cursor.close()

    if prestamo is None:
        return jsonify({"error": "Préstamo no encontrado"}), 404
    return jsonify(prestamo)


@app.route('/prestamos/registrar')
def registrar_prestamo():
    return render_template('registrar_prestamo.html', ubicacion='Registrar préstamo')


# POST /api/prestamos para registrar un préstamo
@app.route('/api/prestamos', methods=['POST'])
def api_registrar_prestamo():
    datos = request.get_json(silent=True) or {}

    libro_id = datos.get('libro_id')
    estudiante = datos.get('estudiante')

    if not libro_id or not estudiante:
        return jsonify({"error": "Completa el libro y el nombre del estudiante"}), 400

    cursor = mysql.connection.cursor()

    cursor.execute("SELECT id, titulo, stock FROM libros WHERE id = %s", (libro_id,))
    libro = cursor.fetchone()

    if libro is None:
        cursor.close()
        return jsonify({"error": "El libro no existe"}), 404

    if libro['stock'] <= 0:
        cursor.close()
        return jsonify({"error": f"No hay stock disponible para '{libro['titulo']}'"}), 400

    sql_prestamo = """INSERT INTO prestamos (libro_id, estudiante, fecha_prestamo, estado)
                  VALUES (%s, %s, CURDATE(), 'pendiente')"""
    cursor.execute(sql_prestamo, (libro_id, estudiante))

    sql_stock = "UPDATE libros SET stock = stock - 1 WHERE id = %s"
    cursor.execute(sql_stock, (libro_id,))

    mysql.connection.commit()
    cursor.close()

    return jsonify({"mensaje": "Préstamo registrado y stock actualizado"}), 201


@app.route('/api/prestamos/<int:id>/devolver', methods=['PATCH'])
def devolver_prestamo(id):
    cursor = mysql.connection.cursor()

    cursor.execute("SELECT libro_id, estado FROM prestamos WHERE id = %s", (id,))
    prestamo = cursor.fetchone()

    if prestamo is None:
        cursor.close()
        return jsonify({"error": "Préstamo no encontrado"}), 404

    if prestamo['estado'] == 'devuelto':
        cursor.close()
        return jsonify({"error": "Este préstamo ya fue devuelto"}), 400

    cursor.execute(
        "UPDATE prestamos SET estado = 'devuelto', fecha_devolucion = CURDATE() WHERE id = %s",
        (id,)
    )
    cursor.execute(
        "UPDATE libros SET stock = stock + 1 WHERE id = %s",
        (prestamo['libro_id'],)
    )

    mysql.connection.commit()
    cursor.close()

    return jsonify({"mensaje": "Préstamo devuelto y stock actualizado"}), 200
# endregion


if __name__ == '__main__':
    app.run(debug=True)