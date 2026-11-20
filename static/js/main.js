function cargarResumenInicio() {
    let elTotalLibros = document.getElementById("resumenTotalLibros");
    if (!elTotalLibros) return;

    let aviso = document.getElementById("resumenAvisoInicio");

    Promise.all([
        fetch("/api/libros").then(r => {
            if (!r.ok) throw new Error("Error en libros: " + r.status);
            return r.json();
        }),
        fetch("/api/prestamos").then(r => {
            if (!r.ok) throw new Error("Error en prestamos: " + r.status);
            return r.json();
        })
    ])
        .then(([dataLibros, dataPrestamos]) => {
            let libros = Array.isArray(dataLibros) ? dataLibros : (dataLibros.libros || []);
            let prestamos = Array.isArray(dataPrestamos) ? dataPrestamos : (dataPrestamos.prestamos || []);

            let totalLibros = libros.length;
            let stockTotal = 0;
            let sinStock = 0;

            let lista = document.getElementById("listaUltimosPrestamos");
            if (lista) {
                lista.innerHTML = "";
                let ultimos = prestamos.slice(-5).reverse();

                if (ultimos.length === 0) {
                    lista.innerHTML = `<li class="list-group-item px-0 text-secondary">Sin préstamos aún.</li>`;
                } else {
                    for (let i = 0; i < ultimos.length; i++) {
                        let p = ultimos[i];
                        let li = document.createElement("li");
                        li.className = "list-group-item px-0 d-flex justify-content-between align-items-center";
                        li.innerHTML = `
                <span><strong>${p.estudiante}</strong> — ${p.libro_titulo || ("Libro #" + p.libro_id)}</span>
                <span class="badge ${p.estado === "devuelto" ? "bg-success" : "bg-warning text-dark"}">${p.estado}</span>
            `;
                        lista.appendChild(li);
                    }
                }
            }

            for (let i = 0; i < libros.length; i++) {
                let s = Number(libros[i].stock) || 0;
                stockTotal += s;
                if (s === 0) sinStock++;
            }

            let pendientes = 0;
            let devueltos = 0;

            for (let i = 0; i < prestamos.length; i++) {
                if (prestamos[i].estado === "pendiente") pendientes++;
                if (prestamos[i].estado === "devuelto") devueltos++;
            }

            elTotalLibros.textContent = totalLibros;
            document.getElementById("resumenStockTotal").textContent = stockTotal;
            document.getElementById("resumenPrestamosPendientes").textContent = pendientes;
            document.getElementById("resumenPrestamosDevueltos").textContent = devueltos;

            if (aviso) {
                aviso.textContent = sinStock > 0
                    ? `Aviso: hay ${sinStock} libro(s) sin stock.`
                    : "Todos los libros tienen stock.";
            }
        })
        .catch(error => {
            console.error("Error en resumen:", error);
            if (aviso) aviso.textContent = error.message;
        });
}

window.addEventListener("load", function () {
    cargarResumenInicio();
});

function mostrarLibros() {
    fetch("/api/libros/")
        .then(response => response.json())
        .then(data => {
            let cuerpo = document.getElementById("cuerpoLibros");
            let mensaje = document.getElementById("mensajeLibros");
            cuerpo.innerHTML = "";

            if (data.length === 0) {
                mensaje.textContent = "No hay libros registrados.";
                return;
            }

            mensaje.textContent = "Total de libros: " + data.length;

            for (let i = 0; i < data.length; i++) {
                let fila = document.createElement("tr");

                let tdId = document.createElement("td");
                tdId.textContent = data[i].id;

                let tdPortada = document.createElement("td");
                tdPortada.className = "col-portada";
                let imgPortada = document.createElement("img");
                imgPortada.className = "portada-libro";
                imgPortada.alt = data[i].titulo;
                imgPortada.title = data[i].titulo;
                tdPortada.appendChild(imgPortada);

                let tdTitulo = document.createElement("td");
                tdTitulo.textContent = data[i].titulo;

                let tdAutor = document.createElement("td");
                tdAutor.textContent = data[i].autor;

                let tdStock = document.createElement("td");
                tdStock.innerHTML = `<span class="badge-stock">${data[i].stock}</span>`;

                let tdAcciones = document.createElement("td");
                tdAcciones.innerHTML = `<a href="/libros/modificar/${data[i].id}" class="btn btn-sm btn-outline-warning text-dark"><i class="bi bi-pencil-square me-1"></i>Modificar</a>`;

                fila.appendChild(tdId);
                fila.appendChild(tdPortada);
                fila.appendChild(tdTitulo);
                fila.appendChild(tdAutor);
                fila.appendChild(tdStock);
                fila.appendChild(tdAcciones);

                cuerpo.appendChild(fila);

                obtenerUrlPortadaPorTitulo(data[i].titulo).then(urlPortada => {
                    if (urlPortada) {
                        imgPortada.src = urlPortada;
                    } else {
                        tdPortada.innerHTML = `<span class="text-secondary small">Sin portada</span>`;
                    }
                });
            }
        })
        .catch(error => {
            console.log(error);
            document.getElementById("mensajeLibros").textContent = "Error al cargar los libros.";
        });
}

function limpiarLibros() {
    document.getElementById("cuerpoLibros").innerHTML = "";
    document.getElementById("mensajeLibros").textContent = "";
}

function obtenerUrlPortadaPorTitulo(titulo) {
    if (!titulo) return Promise.resolve(null);

    let url = `https://openlibrary.org/search.json?title=${encodeURIComponent(titulo)}&limit=1`;

    return fetch(url)
        .then(r => r.json())
        .then(data => {
            if (data.docs && data.docs.length > 0 && data.docs[0].cover_i) {
                return `https://covers.openlibrary.org/b/id/${data.docs[0].cover_i}-S.jpg`;
            }
            return null;
        })
        .catch(() => null);
}

document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("cuerpoLibros")) {
        mostrarLibros();
    }
});

function buscarLibroPorId() {
    let id = document.getElementById("idLibroBuscar").value;
    let mensaje = document.getElementById("mensajeBusquedaLibro");
    let resultado = document.getElementById("resultadoLibro");
    let cuerpo = document.getElementById("cuerpoLibroBuscado");

    if (!id) {
        mensaje.textContent = "Escribe un ID de libro.";
        return;
    }

    mensaje.textContent = "Buscando libro...";
    resultado.classList.add("d-none");
    cuerpo.innerHTML = "";

    fetch("/api/libros/" + id)
        .then(response => response.json().then(data => ({ status: response.status, data: data })))
        .then(({ status, data }) => {
            if (status !== 200 || data.error) {
                mensaje.textContent = data.error || "Libro no encontrado.";
                return;
            }

            mensaje.textContent = "Libro encontrado.";
            resultado.classList.remove("d-none");

            let fila = document.createElement("tr");

            let tdId = document.createElement("td");
            tdId.textContent = data.id;

            let tdPortada = document.createElement("td");
            tdPortada.className = "col-portada";
            let imgPortada = document.createElement("img");
            imgPortada.className = "portada-libro";
            imgPortada.alt = data.titulo;
            imgPortada.title = data.titulo;
            tdPortada.appendChild(imgPortada);

            let tdTitulo = document.createElement("td");
            tdTitulo.textContent = data.titulo;

            let tdAutor = document.createElement("td");
            tdAutor.textContent = data.autor;

            let tdStock = document.createElement("td");
            tdStock.innerHTML = `<span class="badge-stock">${data.stock}</span>`;

            let tdAcciones = document.createElement("td");
            tdAcciones.innerHTML = `<a href="/libros/modificar/${data.id}" class="btn btn-sm btn-outline-warning text-dark"><i class="bi bi-pencil-square me-1"></i>Modificar</a>`;

            fila.appendChild(tdId);
            fila.appendChild(tdPortada);
            fila.appendChild(tdTitulo);
            fila.appendChild(tdAutor);
            fila.appendChild(tdStock);
            fila.appendChild(tdAcciones);

            cuerpo.appendChild(fila);

            obtenerUrlPortadaPorTitulo(data.titulo).then(urlPortada => {
                if (urlPortada) {
                    imgPortada.src = urlPortada;
                } else {
                    tdPortada.innerHTML = `<span class="text-secondary small">Sin portada</span>`;
                }
            });
        })
        .catch(error => {
            console.log(error);
            mensaje.textContent = "Error al buscar el libro.";
        });
}

function limpiarBusquedaLibro() {
    document.getElementById("idLibroBuscar").value = "";
    document.getElementById("mensajeBusquedaLibro").textContent = "";
    document.getElementById("cuerpoLibroBuscado").innerHTML = "";
    document.getElementById("resultadoLibro").classList.add("d-none");
}

function registrarLibro() {
    let titulo = document.getElementById("tituloLibro").value.trim();
    let autor = document.getElementById("autorLibro").value.trim();
    let stock = parseInt(document.getElementById("stockLibro").value, 10);
    let mensaje = document.getElementById("mensajeRegistroLibro");

    if (!titulo || !autor || isNaN(stock)) {
        mensaje.textContent = "Completa todos los campos correctamente.";
        return;
    }

    mensaje.textContent = "Registrando libro...";

    fetch("/api/libros", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            titulo: titulo,
            autor: autor,
            stock: stock
        })
    })
        .then(response => response.json().then(data => ({ status: response.status, data: data })))
        .then(({ status, data }) => {
            if (status !== 201 || data.error) {
                mensaje.textContent = data.error || "No se pudo registrar el libro.";
                return;
            }

            mensaje.textContent = data.mensaje || "Libro registrado.";
            limpiarFormularioLibro();
        })
        .catch(error => {
            console.log(error);
            mensaje.textContent = "Error al registrar el libro.";
        });
}

function limpiarFormularioLibro() {
    document.getElementById("tituloLibro").value = "";
    document.getElementById("autorLibro").value = "";
    document.getElementById("stockLibro").value = "1";
}

function cargarDatosLibroParaEditar() {
    let inputId = document.getElementById("idLibroEditar");
    if (!inputId) return;

    let id = inputId.value;
    let mensaje = document.getElementById("mensajeEditarLibro");
    mensaje.textContent = "Cargando datos del libro...";

    fetch("/api/libros/" + id)
        .then(response => response.json().then(data => ({ status: response.status, data: data })))
        .then(({ status, data }) => {
            if (status !== 200 || data.error) {
                mensaje.textContent = data.error || "No se pudo cargar el libro.";
                return;
            }

            document.getElementById("tituloLibroEditar").value = data.titulo;
            document.getElementById("autorLibroEditar").value = data.autor;
            document.getElementById("stockLibroEditar").value = data.stock;
            mensaje.textContent = "";
        })
        .catch(error => {
            console.log(error);
            mensaje.textContent = "Error al obtener los datos del libro.";
        });
}

function guardarCambiosLibro() {
    let id = document.getElementById("idLibroEditar").value;
    let titulo = document.getElementById("tituloLibroEditar").value.trim();
    let autor = document.getElementById("autorLibroEditar").value.trim();
    let stock = parseInt(document.getElementById("stockLibroEditar").value, 10);
    let mensaje = document.getElementById("mensajeEditarLibro");

    if (!titulo || !autor || isNaN(stock)) {
        mensaje.textContent = "Completa todos los campos correctamente.";
        return;
    }

    mensaje.textContent = "Guardando cambios...";

    fetch("/api/libros/" + id, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            titulo: titulo,
            autor: autor,
            stock: stock
        })
    })
        .then(response => response.json().then(data => ({ status: response.status, data: data })))
        .then(({ status, data }) => {
            if (status !== 200 || data.error) {
                mensaje.textContent = data.error || "No se pudo actualizar.";
                return;
            }

            window.location.href = "/libros";
        })
        .catch(error => {
            console.log(error);
            mensaje.textContent = "Error al guardar los cambios.";
        });
}

document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("idLibroEditar")) {
        cargarDatosLibroParaEditar();
    }
});

function mostrarPrestamos() {
    fetch("/api/prestamos")
        .then(response => response.json())
        .then(data => {
            let cuerpo = document.getElementById("cuerpoPrestamos");
            let mensaje = document.getElementById("mensajePrestamos");
            cuerpo.innerHTML = "";

            if (data.length === 0) {
                mensaje.textContent = "No hay préstamos registrados.";
                return;
            }

            mensaje.textContent = "Total de préstamos: " + data.length;

            for (let i = 0; i < data.length; i++) {
                let fila = document.createElement("tr");

                let tdId = document.createElement("td");
                tdId.textContent = data[i].id;

                let tdLibro = document.createElement("td");
                tdLibro.textContent = data[i].libro;

                let tdEstudiante = document.createElement("td");
                tdEstudiante.textContent = data[i].estudiante;

                let tdFechaPrestamo = document.createElement("td");
                tdFechaPrestamo.textContent = formatearSoloDia(data[i].fecha_prestamo);

                let tdFechaDevolucion = document.createElement("td");
                tdFechaDevolucion.textContent = formatearSoloDia(data[i].fecha_devolucion);

                let tdEstado = document.createElement("td");
                let estadoTexto = data[i].estado;
                let claseBadge = estadoTexto === "devuelto" ? "badge-devuelto" : "badge-prestado";
                tdEstado.innerHTML = `<span class="badge-estado ${claseBadge}">${estadoTexto}</span>`;

                fila.appendChild(tdId);
                fila.appendChild(tdLibro);
                fila.appendChild(tdEstudiante);
                fila.appendChild(tdFechaPrestamo);
                fila.appendChild(tdEstado);
                fila.appendChild(tdFechaDevolucion);
                fila.appendChild(crearCeldaAccionPrestamo(data[i], mostrarPrestamos));
                cuerpo.appendChild(fila);
            }
        })
        .catch(error => {
            console.log(error);
            document.getElementById("mensajePrestamos").textContent = "Error al cargar los préstamos.";
        });
}

function limpiarPrestamos() {
    document.getElementById("cuerpoPrestamos").innerHTML = "";
    document.getElementById("mensajePrestamos").textContent = "";
}

document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("cuerpoPrestamos")) {
        mostrarPrestamos();
    }
});

function buscarPrestamoPorId() {
    let id = document.getElementById("idPrestamoBuscar").value;
    let mensaje = document.getElementById("mensajeBusquedaPrestamo");
    let resultado = document.getElementById("resultadoPrestamo");
    let cuerpo = document.getElementById("cuerpoPrestamoBuscado");

    if (!id) {
        mensaje.textContent = "Escribe un ID de préstamo.";
        return;
    }

    mensaje.textContent = "Buscando préstamo...";
    resultado.classList.add("d-none");
    cuerpo.innerHTML = "";

    fetch("/api/prestamos/" + id)
        .then(response => response.json().then(data => ({ status: response.status, data: data })))
        .then(({ status, data }) => {
            if (status !== 200 || data.error) {
                mensaje.textContent = data.error || "Préstamo no encontrado.";
                return;
            }

            mensaje.textContent = "Préstamo encontrado.";
            resultado.classList.remove("d-none");

            let fila = document.createElement("tr");

            let tdId = document.createElement("td");
            tdId.textContent = data.id;

            let tdLibro = document.createElement("td");
            tdLibro.textContent = data.libro;

            let tdEstudiante = document.createElement("td");
            tdEstudiante.textContent = data.estudiante;

            let tdFechaPrestamo = document.createElement("td");
            tdFechaPrestamo.textContent = formatearSoloDia(data.fecha_prestamo);

            let tdFechaDevolucion = document.createElement("td");
            tdFechaDevolucion.textContent = formatearSoloDia(data.fecha_devolucion);

            let tdEstado = document.createElement("td");
            let estadoTexto = data.estado;
            let claseBadge = estadoTexto === "devuelto" ? "badge-devuelto" : "badge-prestado";
            tdEstado.innerHTML = `<span class="badge-estado ${claseBadge}">${estadoTexto}</span>`;

            fila.appendChild(tdId);
            fila.appendChild(tdLibro);
            fila.appendChild(tdEstudiante);
            fila.appendChild(tdFechaPrestamo);
            fila.appendChild(tdEstado);
            fila.appendChild(tdFechaDevolucion);
            fila.appendChild(crearCeldaAccionPrestamo(data, buscarPrestamoPorId));
            cuerpo.appendChild(fila);
        })
        .catch(error => {
            console.log(error);
            mensaje.textContent = "Error al buscar el préstamo.";
        });
}

function limpiarBusquedaPrestamo() {
    document.getElementById("idPrestamoBuscar").value = "";
    document.getElementById("mensajeBusquedaPrestamo").textContent = "";
    document.getElementById("cuerpoPrestamoBuscado").innerHTML = "";
    document.getElementById("resultadoPrestamo").classList.add("d-none");
}

function cargarLibrosParaPrestamo() {
    let select = document.getElementById("libroPrestamo");
    if (!select) return;

    fetch("/api/libros/")
        .then(response => response.json())
        .then(data => {
            select.innerHTML = '<option value="">Selecciona un libro</option>';

            for (let i = 0; i < data.length; i++) {
                let opcion = document.createElement("option");
                opcion.value = data[i].id;
                opcion.textContent = `${data[i].titulo} (Stock: ${data[i].stock})`;
                if (data[i].stock <= 0) {
                    opcion.disabled = true;
                }
                select.appendChild(opcion);
            }
        })
        .catch(error => {
            console.log(error);
            select.innerHTML = '<option value="">Error al cargar libros</option>';
        });
}

function registrarPrestamo() {
    let libroId = document.getElementById("libroPrestamo").value;
    let estudiante = document.getElementById("estudiantePrestamo").value.trim();
    let mensaje = document.getElementById("mensajeRegistroPrestamo");

    if (!libroId || !estudiante) {
        mensaje.textContent = "Selecciona un libro y escribe el nombre del estudiante.";
        return;
    }

    mensaje.textContent = "Registrando préstamo...";

    fetch("/api/prestamos", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            libro_id: parseInt(libroId, 10),
            estudiante: estudiante
        })
    })
        .then(response => response.json().then(data => ({ status: response.status, data: data })))
        .then(({ status, data }) => {
            if (status !== 201 || data.error) {
                mensaje.textContent = data.error || "No se pudo registrar el préstamo.";
                return;
            }

            mensaje.textContent = data.mensaje || "Préstamo registrado.";
            document.getElementById("estudiantePrestamo").value = "";
            cargarLibrosParaPrestamo();
        })
        .catch(error => {
            console.log(error);
            mensaje.textContent = "Error al registrar el préstamo.";
        });
}

function limpiarFormularioPrestamo() {
    document.getElementById("libroPrestamo").value = "";
    document.getElementById("estudiantePrestamo").value = "";
    document.getElementById("mensajeRegistroPrestamo").textContent = "";
}

document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("libroPrestamo")) {
        cargarLibrosParaPrestamo();
    }
});

function crearCeldaAccionPrestamo(prestamo, alTerminar) {
    let tdAcciones = document.createElement("td");

    if (prestamo.estado === "devuelto") {
        tdAcciones.innerHTML = `<span class="text-secondary small">Ya devuelto</span>`;
        return tdAcciones;
    }

    let boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn btn-sm btn-success";
    boton.textContent = "Devuelto";

    boton.addEventListener("click", function () {
        boton.disabled = true;
        boton.textContent = "Guardando...";

        fetch(`/api/prestamos/${prestamo.id}/devolver`, {
            method: "PATCH"
        })
            .then(response => response.json().then(data => ({ status: response.status, data: data })))
            .then(({ status, data }) => {
                if (status !== 200 || data.error) {
                    alert(data.error || "No se pudo marcar como devuelto.");
                    boton.disabled = false;
                    boton.textContent = "Devuelto";
                    return;
                }

                if (alTerminar) {
                    alTerminar();
                }
            })
            .catch(error => {
                console.log(error);
                alert("Error al actualizar el préstamo.");
                boton.disabled = false;
                boton.textContent = "Devuelto";
            });
    });

    tdAcciones.appendChild(boton);
    return tdAcciones;
}

function formatearSoloDia(valorFecha) {
    if (!valorFecha) return "-";

    let fecha = new Date(valorFecha);
    if (isNaN(fecha.getTime())) {
        return String(valorFecha).split("T")[0];
    }

    let anio = fecha.getUTCFullYear();
    let mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
    let dia = String(fecha.getUTCDate()).padStart(2, "0");

    return `${dia}-${mes}-${anio}`;
}