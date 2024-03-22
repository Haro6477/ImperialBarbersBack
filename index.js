const express = require("express");
const cors = require("cors");
const app = express();
const mysql = require("mysql2");
const multer = require('multer')
const path = require('path')
const fs = require('fs');
const sharp = require('sharp');

const { PORT, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = require("./config");
const options = { year: 'numeric', month: '2-digit', day: '2-digit' }

const corsOptions = {
    origin: function (origin, callback) {
        callback(null, origin); // Devuelve el origen como el valor del encabezado
    },
    credentials: true // Indica que se aceptan las credenciales
};

// Aquí puedes usar el paquete cors con las opciones que creaste
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dbimages')))

// Conexión db
const db_config = {
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: DB_PORT
}

var connection;

function handleDisconnect() {
    connection = mysql.createConnection(db_config);

    connection.connect(function (err) {
        if (err) {
            console.log('error cuando se conectaba a la base de datos:', err);
            setTimeout(handleDisconnect, 2000);
        }
    });
    connection.on('error', function (err) {
        console.log('error de base de datos: ', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnect();
        } else {
            throw err;
        }
    });
}

handleDisconnect();

// Función para autenticación
app.get("/auth/:user/:pass", (req, res) => {
    const usuario = req.params.user
    const pass = req.params.pass

    connection.query('SELECT id FROM empleados WHERE usuario=? AND pass=?', [usuario, pass],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.put("/cambio-municipio", (req, res) => {
    const id = req.body.id
    const municipio = req.body.municipio
    connection.query('UPDATE empleados SET municipio=? WHERE id=?', [municipio, id],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    )
})

// Funciones para los clientes
app.get("/clientes", (req, res) => {

    connection.query('SELECT * FROM clientes order by nombre',
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/clientes/:municipio", (req, res) => {
    const municipio = req.params.municipio;

    connection.query('SELECT * FROM clientes where municipio = ? order by nombre', municipio,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.post("/create-cliente", (req, res) => {
    const nombre = req.body.nombre
    const telefono = req.body.telefono
    const pts = req.body.pts
    const genero = req.body.genero
    const fechaNacimiento = req.body.fechaNacimiento
    const codigoQR = req.body.codigoQR
    const municipio = req.body.municipio

    connection.query('INSERT INTO clientes(nombre,telefono,pts,genero,fechaNacimiento,codigoQR,municipio) VALUES(?,?,?,?,?,?,?)',
        [nombre, telefono, pts, genero, fechaNacimiento, codigoQR, municipio],
        (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send("Error al insertar el cliente");
            } else {
                connection.query(
                    'SELECT * FROM clientes WHERE id = ?',
                    [result.insertId],
                    (err, rows) => {
                        if (err) {
                            console.log(err);
                            res.status(500).send("Error al obtener el cliente insertado");
                        } else {
                            res.send(rows[0]);
                        }
                    }
                );
            }
        }
    );
});

app.put("/update-cliente", (req, res) => {
    const id = req.body.id
    const nombre = req.body.nombre
    const telefono = req.body.telefono
    const pts = req.body.pts
    const genero = req.body.genero
    const fechaNacimiento = req.body.fechaNacimiento
    const codigoQR = req.body.codigoQR
    const municipio = req.body.municipio

    connection.query('UPDATE clientes SET nombre=?,telefono=?,pts=?,genero=?,fechaNacimiento=?,codigoQR=?,municipio=? WHERE id=?',
        [nombre, telefono, pts, genero, fechaNacimiento, codigoQR, municipio, id],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.delete("/delete-cliente/:id", (req, res) => {
    const id = req.params.id;

    connection.query('DELETE FROM clientes WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/cliente/:id", (req, res) => {
    const id = req.params.id

    connection.query('SELECT * FROM clientes WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

// Funciones para los empleados
app.get("/empleados", (req, res) => {
    connection.query('SELECT id, usuario, pass, nombre, telefono, correo, fechaNacimiento, fechaInicio, puesto, estatus, color, municipio FROM empleados WHERE id <> 7 order by nombre',
        (err, rows) => {
            if (err) { console.log(err) }
            else {
                res.send(rows)
            }
        }
    )
})

app.get("/empleados/:municipio", (req, res) => {
    const municipio = req.params.municipio
    connection.query('SELECT id, usuario, pass, nombre, telefono, correo, fechaNacimiento, fechaInicio, puesto, estatus, color, municipio FROM empleados WHERE municipio = ? order by nombre', municipio,
        (err, rows) => {
            if (err) { console.log(err) }
            else {
                res.send(rows)
            }
        }
    )
})

const formatearFecha = (fecha) => {
    const date = new Date(fecha);
    const yyyy = date.getFullYear()
    let mm = date.getMonth() + 1
    let dd = date.getDate()

    if (dd < 10) dd = '0' + dd
    if (mm < 10) mm = '0' + mm

    const fechaFormateada = yyyy + '-' + mm + '-' + dd + ' 00:00:00';
    return fechaFormateada
}
app.get("/servicios-semana-all/:id", (req, res) => {
    const id = req.params.id
    const now = new Date().toLocaleDateString('es-mx', options).split('/').reverse().join('-')
    const lunes = new Date(now + 'T00:00:00')
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);
    const expresion = 'SELECT ds.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, ds.precioActual, ds.cantidad, s.nombre AS servicio FROM detallescobroservicios AS ds '
        + ' INNER JOIN cobros AS c ON ds.idCobro = c.id'
        + ' INNER JOIN clientes AS cl ON c.idCliente = cl.id'
        + ' INNER JOIN empleados AS e ON ds.idBarber = e.id'
        + ' INNER JOIN servicios AS s ON ds.idServicio = s.id'
        + " WHERE fecha < '" + formatearFecha(lunes) + "' AND c.idCliente != '122' AND ds.idBarber = " + id
        + ' order by fecha desc'
    connection.query(expresion,
        (err, rows) => {
            if (err) { console.log(err) }
            else {
                res.send(rows)
            }
        })
})
app.get("/servicios-semana", (req, res) => {
    const now = new Date().toLocaleDateString('es-mx', options).split('/').reverse().join('-')
    const lunes = new Date(now + 'T00:00:00')
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);
    const expresion = 'SELECT ds.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, ds.precioActual, ds.cantidad, s.nombre AS servicio FROM detallescobroservicios AS ds '
        + ' INNER JOIN cobros AS c ON ds.idCobro = c.id'
        + ' INNER JOIN clientes AS cl ON c.idCliente = cl.id'
        + ' INNER JOIN empleados AS e ON ds.idBarber = e.id'
        + ' INNER JOIN servicios AS s ON ds.idServicio = s.id'
        + " WHERE fecha >= '" + formatearFecha(lunes) + "' AND c.idCliente != '122'"
        + ' order by fecha desc'
    connection.query(expresion,
        (err, rows) => {
            if (err) { console.log(err) }
            else {
                res.send(rows)
            }
        })
})
app.get("/servicios-semana/:id", (req, res) => {
    const id = req.params.id
    const now = new Date().toLocaleDateString('es-mx', options).split('/').reverse().join('-')
    const lunes = new Date(now + 'T00:00:00')
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);

    const expresion = 'SELECT ds.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, ds.precioActual, ds.cantidad, s.nombre AS servicio FROM detallescobroservicios AS ds '
        + ' INNER JOIN cobros AS c ON ds.idCobro = c.id'
        + ' INNER JOIN clientes AS cl ON c.idCliente = cl.id'
        + ' INNER JOIN empleados AS e ON ds.idBarber = e.id'
        + ' INNER JOIN servicios AS s ON ds.idServicio = s.id'
        + " WHERE fecha >= '" + formatearFecha(lunes) + "' AND c.idCliente != '122' AND ds.idBarber = " + id
        + ' order by fecha desc'
    connection.query(expresion,
        (err, rows) => {
            if (err) { console.log(err) }
            else {
                res.send(rows)
            }
        })
})
app.get("/productos-semana-all/:id", (req, res) => {
    const id = req.params.id
    const now = new Date().toLocaleDateString('es-mx', options).split('/').reverse().join('-')
    const lunes = new Date(now + 'T00:00:00')
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);
    const expresion = 'SELECT dp.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, dp.precioActual, dp.cantidad, p.nombre AS producto FROM detallescobroproductos AS dp '
        + ' INNER JOIN cobros AS c ON dp.idCobro = c.id'
        + ' INNER JOIN clientes AS cl ON c.idCliente = cl.id'
        + ' INNER JOIN empleados AS e ON dp.idBarber = e.id'
        + ' INNER JOIN productos AS p ON dp.idProducto = p.id'
        + " WHERE fecha < '" + formatearFecha(lunes) + "' AND c.idCliente != '122' AND dp.idBarber = " + id
        + ' order by fecha desc'
    connection.query(expresion,
        (err, rows) => {
            if (err) { console.log(err) }
            else {
                res.send(rows)
            }
        })
})
app.get("/productos-semana", (req, res) => {
    const now = new Date().toLocaleDateString('es-mx', options).split('/').reverse().join('-')
    const lunes = new Date(now + 'T00:00:00')
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);
    const expresion = 'SELECT dp.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, dp.precioActual, dp.cantidad, p.nombre AS producto FROM detallescobroproductos AS dp '
        + ' INNER JOIN cobros AS c ON dp.idCobro = c.id'
        + ' INNER JOIN clientes AS cl ON c.idCliente = cl.id'
        + ' INNER JOIN empleados AS e ON dp.idBarber = e.id'
        + ' INNER JOIN productos AS p ON dp.idProducto = p.id'
        + " WHERE fecha >= '" + formatearFecha(lunes) + "' AND c.idCliente != '122'"
        + ' order by fecha desc'
    connection.query(expresion,
        (err, rows) => {
            if (err) { console.log(err) }
            else {
                res.send(rows)
            }
        })
})
app.get("/productos-semana/:id", (req, res) => {
    const id = req.params.id
    const now = new Date().toLocaleDateString('es-mx', options).split('/').reverse().join('-')
    const lunes = new Date(now + 'T00:00:00')
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);
    const expresion = 'SELECT dp.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, dp.precioActual, dp.cantidad, p.nombre AS producto FROM detallescobroproductos AS dp '
        + ' INNER JOIN cobros AS c ON dp.idCobro = c.id'
        + ' INNER JOIN clientes AS cl ON c.idCliente = cl.id'
        + ' INNER JOIN empleados AS e ON dp.idBarber = e.id'
        + ' INNER JOIN productos AS p ON dp.idProducto = p.id'
        + " WHERE fecha >= '" + formatearFecha(lunes) + "' AND c.idCliente != '122' AND dp.idBarber = " + id
        + ' order by fecha desc'
    connection.query(expresion,
        (err, rows) => {
            if (err) { console.log(err) }
            else {
                res.send(rows)
            }
        })
})

app.get("/fotos-empleados", (req, res) => {

    connection.query('SELECT id, foto FROM empleados',
        (err, rows) => {
            if (err) { alert(err) }
            else {
                rows.map(img => {
                    if (img.foto)
                        fs.writeFileSync(path.join(__dirname, './dbimages/empleado' + img.id + '.jpeg'), img.foto)
                })
                const imagedir = fs.readdirSync(path.join(__dirname, './dbimages/'))
                res.json(imagedir)
            }
        }
    );
});

app.get("/foto-empleado/:id", (req, res) => {
    const id = req.params.id
    connection.query('SELECT id, foto FROM empleados WHERE id = ?', id,
        (err, row) => {
            if (err) { console.log(err) }
            else {
                if (row[0].foto) {
                    fs.writeFileSync(path.join(__dirname, './dbimages/empleado' + row[0].id + '.jpeg'), row[0].foto)
                    const imageDir = fs.readdirSync(path.join(__dirname, './dbimages/'))
                    res.json('empleado' + row[0].id + '.jpeg')
                } else {
                    res.json(null)
                }
            }
        }
    );
})

app.post("/create-empleado", (req, res) => {
    const usuario = req.body.usuario
    const pass = req.body.pass
    const nombre = req.body.nombre
    const telefono = req.body.telefono
    const correo = req.body.correo
    const fechaNacimiento = req.body.fechaNacimiento
    const fechaInicio = req.body.fechaInicio
    const puesto = req.body.puesto
    const estatus = req.body.estatus
    const foto = req.body.foto
    const municipio = req.body.municipio

    connection.query('INSERT INTO empleados(usuario,pass,nombre,telefono,correo,fechaNacimiento,fechaInicio,puesto,estatus,foto,municipio) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        [usuario, pass, nombre, telefono, correo, fechaNacimiento, fechaInicio, puesto, estatus, foto, municipio],
        (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send("Error al insertar el empleado");
            } else {
                connection.query(
                    'SELECT * FROM empleados WHERE id = ?',
                    [result.insertId],
                    (err, rows) => {
                        if (err) {
                            console.log(err);
                            res.status(500).send("Error al obtener el empleado insertado");
                        } else {
                            res.send(rows[0]);
                        }
                    }
                );
            }
        }
    );
});

app.put("/update-empleado", (req, res) => {
    const id = req.body.id
    const usuario = req.body.usuario
    const pass = req.body.pass
    const nombre = req.body.nombre
    const telefono = req.body.telefono
    const correo = req.body.correo
    const fechaNacimiento = req.body.fechaNacimiento
    const fechaInicio = req.body.fechaInicio
    const puesto = req.body.puesto
    const estatus = req.body.estatus
    const municipio = req.body.municipio

    connection.query('UPDATE empleados SET usuario=?,pass=?,nombre=?,telefono=?,correo=?,fechaNacimiento=?,fechaInicio=?,puesto=?,estatus=?,municipio=? WHERE id=?',
        [usuario, pass, nombre, telefono, correo, fechaNacimiento, fechaInicio, puesto, estatus, municipio, id],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});
app.put("/update-empleado-datos", (req, res) => {
    const id = req.body.id
    const usuario = req.body.usuario
    const nombre = req.body.nombre
    const telefono = req.body.telefono
    const correo = req.body.correo
    const fechaNacimiento = req.body.fechaNacimiento
    const color = req.body.color
    const municipio = req.body.municipio

    connection.query('UPDATE empleados SET usuario=?,nombre=?,telefono=?,correo=?,fechaNacimiento=?, color=?, municipio=? WHERE id=?',
        [usuario, nombre, telefono, correo, fechaNacimiento, color, municipio, id],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});
app.put("/update-password", (req, res) => {
    const id = req.body.id
    const pass = req.body.pass
    connection.query('UPDATE empleados SET pass=? WHERE id=?',
        [pass, id],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.put("/update-empleado-municipio", (req, res) => {
    const idBarber = req.body.id
    const municipio = req.body.municipio
    connection.query('UPDATE empleados SET municipio=? WHERE id=?',
        [municipio, idBarber],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});


const diskStorage = multer.diskStorage({
    destination: path.join(__dirname, './images'),
    filename: (req, file, cb) => {
        cb(null, file.originalname)
    }
})

const fileUpload = multer({
    storage: diskStorage
}).single('image')


app.put('/update-foto-empleado', fileUpload, (req, res) => {
    const id = req.body.id
    const type = req.file.mimetype
    const name = req.file.originalname
    const imagePath = path.join(__dirname, './images/' + req.file.filename)

    const width = 420; 
    const format = 'webp'; 

    sharp(imagePath)
        .resize(width)
        .toFormat(format)
        .toBuffer()
        .then(data => {
            connection.query('UPDATE empleados set foto = ? WHERE id = ?', [data, id], (err, result) => {
                if (err) return res.status(500).send('Error al actualizar foto')
                else res.send("Foto actualizada\nActualizar para mostrar cambios")
            })
        })
        .catch(err => {
            // Maneja cualquier error que ocurra durante la manipulación de la imagen
            console.error(err);
            res.status(500).send('Error al procesar la imagen');
        });
})

app.delete("/delete-empleado/:id", (req, res) => {
    const id = req.params.id;

    connection.query('DELETE FROM empleados WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/empleado/:id", (req, res) => {
    const id = req.params.id

    connection.query('SELECT usuario, pass, nombre, telefono, correo, fechaNacimiento, fechaInicio, fechaInicio, puesto, estatus, color, municipio FROM empleados WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

// Funciones para los servicios
app.get("/servicios/:municipio", (req, res) => {
    const municipio = req.params.municipio

    connection.query('SELECT * FROM servicios where municipio = ? order by nombre', municipio,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.post("/create-servicio", (req, res) => {
    const nombre = req.body.nombre
    const descripcion = req.body.descripcion
    const precio = req.body.precio
    const pts = req.body.pts
    const municipio = req.body.municipio

    connection.query('INSERT INTO servicios(nombre,descripcion,precio,pts,municipio) VALUES(?,?,?,?,?)',
        [nombre, descripcion, precio, pts, municipio],
        (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send("Error al insertar el servicio");
            } else {
                connection.query(
                    'SELECT * FROM servicios WHERE id = ?',
                    [result.insertId],
                    (err, rows) => {
                        if (err) {
                            console.log(err);
                            res.status(500).send("Error al obtener el servicio insertado");
                        } else {
                            res.send(rows[0]);
                        }
                    }
                );
            }
        }
    );
});

app.put("/update-servicio", (req, res) => {
    const id = req.body.id
    const nombre = req.body.nombre
    const descripcion = req.body.descripcion
    const precio = req.body.precio
    const pts = req.body.pts

    connection.query('UPDATE servicios SET nombre=?,descripcion=?,precio=?,pts=? WHERE id=?',
        [nombre, descripcion, precio, pts, id],
        (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send("Error al actualizar el servicio");
            } else {
                connection.query(
                    'SELECT * FROM servicios WHERE id = ?',
                    [result.insertId],
                    (err, rows) => {
                        if (err) {
                            console.log(err);
                            res.status(500).send("Error al obtener el servicio actualizado");
                        } else {
                            res.send(rows[0]);
                        }
                    }
                );
            }
        }
    );
});

app.delete("/delete-servicio/:id", (req, res) => {
    const id = req.params.id;

    connection.query('DELETE FROM servicios WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/servicio/:id", (req, res) => {
    const id = req.params.id

    connection.query('SELECT * FROM servicios WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

// Funciones para los productos
app.get("/productos/:municipio", (req, res) => {
    const municipio = req.params.municipio

    connection.query('SELECT * FROM productos where municipio = ? order by nombre', municipio,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.post("/create-producto", (req, res) => {
    const nombre = req.body.nombre
    const marca = req.body.marca
    const linea = req.body.linea
    const contenido = req.body.contenido
    const enVenta = req.body.enVenta
    const suministros = req.body.suministros
    const almacen = req.body.almacen
    const descripcion = req.body.descripcion
    const costo = req.body.costo
    const precio = req.body.precio
    const pts = req.body.pts
    const imagen = req.body.imagen
    const municipio = req.body.municipio
    connection.query('INSERT INTO productos(nombre,marca,linea,contenido,enVenta,suministros,almacen,descripcion,costo,precio,pts,imagen,municipio) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [nombre, marca, linea, contenido, enVenta, suministros, almacen, descripcion, costo, precio, pts, imagen, municipio],
        (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send("Error al insertar el producto");
            } else {
                connection.query(
                    'SELECT * FROM productos WHERE id = ?',
                    [result.insertId],
                    (err, rows) => {
                        if (err) {
                            console.log(err);
                            res.status(500).send("Error al obtener el producto insertado");
                        } else {
                            res.send(rows[0]);
                        }
                    }
                );
            }
        }
    );
});

app.put("/update-producto", (req, res) => {
    const id = req.body.id
    const nombre = req.body.nombre
    const marca = req.body.marca
    const linea = req.body.linea
    const contenido = req.body.contenido
    const enVenta = req.body.enVenta
    const suministros = req.body.suministros
    const almacen = req.body.almacen
    const descripcion = req.body.descripcion
    const costo = req.body.costo
    const precio = req.body.precio
    const pts = req.body.pts
    const imagen = req.body.imagen

    connection.query('UPDATE productos SET nombre=?,marca=?,linea=?,contenido=?,enVenta=?,suministros=?,almacen=?,descripcion=?,costo=?,precio=?,pts=?,imagen=? WHERE id=?',
        [nombre, marca, linea, contenido, enVenta, suministros, almacen, descripcion, costo, precio, pts, imagen, id],
        (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send("Error al actualizar el producto");
            } else {
                connection.query(
                    'SELECT * FROM productos WHERE id = ?',
                    [result.insertId],
                    (err, rows) => {
                        if (err) {
                            console.log(err);
                            res.status(500).send("Error al obtener el producto actualizado");
                        } else {
                            res.send(rows[0]);
                        }
                    }
                );
            }
        }
    );
});

app.delete("/delete-producto/:id", (req, res) => {
    const id = req.params.id;

    connection.query('DELETE FROM productos WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/producto/:id", (req, res) => {
    const id = req.params.id

    connection.query('SELECT * FROM productos WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

// Permisos
app.get("/permisos", (req, res) => {
    connection.query('SELECT * FROM permisos order by permiso',
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.get("/permisos-usuario/:id", (req, res) => {
    const id = req.params.id

    connection.query('SELECT permiso FROM permisos WHERE idEmpleado=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.post("/create-permisos", (req, res) => {
    const permisos = req.body.permisos
    let values = ''
    permisos.forEach(permiso => {
        values += '("' + permiso.permiso + '",' + permiso.idEmpleado + '),'
    });
    connection.query("INSERT INTO permisos(permiso, idEmpleado) VALUES " + values.slice(0, -1),
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.delete("/delete-permisos/:id", (req, res) => {
    const id = req.params.id;

    connection.query('DELETE FROM permisos WHERE idEmpleado=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});


// Funciones para los cobros o ventas
app.get("/cobros/:municipio", (req, res) => {
    const municipio = req.params.municipio

    const query = 'SELECT v.id, c.nombre as cliente, total, descuento, subtotal, totalPuntos, metodoPago, b.nombre as barber, s.nombre as cobrador, fecha, pagoEfectivo, pagoTarjeta, pagoPuntos, v.municipio '
        + 'from cobros as v '
        + 'inner join clientes as c on v.idCliente = c.id '
        + 'inner join empleados as b on v.idBarber = b.id '
        + 'inner join empleados as s on v.idCobrador = s.id WHERE v.municipio = ' + municipio + ' order by fecha desc LIMIT 300'
    connection.query(query,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/cobros-hoy/:municipio", (req, res) => {
    const municipio = req.params.municipio

    const query = 'SELECT v.id, c.nombre as cliente, total, descuento, subtotal, totalPuntos, metodoPago, b.nombre as barber, s.nombre as cobrador, fecha, pagoEfectivo, pagoTarjeta, pagoPuntos, v.municipio '
        + 'from cobros as v '
        + 'inner join clientes as c on v.idCliente = c.id '
        + 'inner join empleados as b on v.idBarber = b.id '
        + "inner join empleados as s on v.idCobrador = s.id WHERE DATE(fecha) = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) and v.municipio = " + municipio + " order by fecha desc"
    connection.query(query,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/cobro/:id", (req, res) => {
    const id = req.params.id
    const query = 'SELECT v.id, c.nombre as cliente, total, descuento, subtotal, totalPuntos, metodoPago, b.nombre as barber, s.nombre as cobrador, fecha, pagoEfectivo, pagoTarjeta, pagoPuntos '
        + 'from cobros as v '
        + 'inner join clientes as c on v.idCliente = c.id '
        + 'inner join empleados as b on v.idBarber = b.id '
        + 'inner join empleados as s on v.idCobrador = s.id WHERE v.id = ?'
    connection.query(query, id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.post("/create-cobro", (req, res) => {
    const idCliente = req.body.idCliente
    const total = req.body.total
    const descuento = req.body.descuento
    const subtotal = req.body.subtotal
    const totalPuntos = req.body.totalPuntos
    const metodoPago = req.body.metodoPago
    const idBarber = req.body.idBarber
    const idCobrador = req.body.idCobrador
    const pagoEfectivo = req.body.pagoEfectivo
    const pagoTarjeta = req.body.pagoTarjeta
    const pagoPuntos = req.body.pagoPuntos
    const municipio = req.body.municipio
    connection.query('INSERT INTO cobros(idCliente,total,descuento,subtotal,totalPuntos,metodoPago,idBarber,idCobrador,pagoEfectivo,pagoTarjeta,pagoPuntos,municipio) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        [idCliente, total, descuento, subtotal, totalPuntos, metodoPago, idBarber, idCobrador, pagoEfectivo, pagoTarjeta, pagoPuntos, municipio],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

// Inventario puntos y caja
app.get("/caja/:municipio", (req, res) => {
    const municipio = req.params.municipio

    const query = 'SELECT * FROM caja WHERE municipio = ?'
    connection.query(query, municipio,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.put("/update-caja", (req, res) => {
    const id = req.body.id
    const efectivo = req.body.efectivo
    const dineroElectronico = req.body.dineroElectronico
    const puntos = req.body.puntos

    connection.query('UPDATE caja SET efectivo=efectivo+?, dineroElectronico=dineroElectronico+?, puntos=puntos+? WHERE id=?',
        [efectivo, dineroElectronico, puntos, id],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});


app.put("/update-cliente-pts", (req, res) => {
    const id = req.body.id
    const pts = req.body.pts

    connection.query('UPDATE clientes SET pts=pts+? WHERE id=?',
        [pts, id],
        (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send("Error al actualizar puntos");
            } else {
                connection.query(
                    'SELECT * FROM clientes WHERE id = ?',
                    [id],
                    (err, rows) => {
                        if (err) {
                            console.log(err);
                            res.status(500).send("Error al obtener el cliente modificado");
                        } else {
                            res.send(rows[0]);
                        }
                    }
                );
            }
        }
    );
});

app.put("/update-inventario", (req, res) => {
    const id = req.body.id
    const cantidad = req.body.cantidad

    connection.query('UPDATE productos SET enVenta=enVenta+? WHERE id=?',
        [cantidad, id],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.post("/create-movimiento", (req, res) => {
    const concepto = req.body.concepto
    const cantidad = req.body.cantidad
    const idUsuario = req.body.idUsuario
    const municipio = req.body.municipio
    connection.query('INSERT INTO movimientos(concepto,cantidad,idUsuario,municipio) VALUES(?,?,?,?)',
        [concepto, cantidad, idUsuario, municipio],
        (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send("Error al insertar movimiento");
            } else {
                connection.query(
                    "SELECT m.id, concepto, cantidad, fechaHora, nombre, m.municipio FROM movimientos as m INNER JOIN empleados on idUsuario = empleados.id WHERE m.id = ?",

                    [result.insertId],
                    (err, rows) => {
                        if (err) {
                            console.log(err);
                            res.status(500).send("Error al obtener el movimiento insertado");
                        } else {
                            res.send(rows[0]);
                        }
                    }
                );
            }
        }
    );
});

app.get("/movimientos/:municipio", (req, res) => {
    const municipio = req.params.municipio
    const query = "SELECT m.id, concepto, cantidad, fechaHora, nombre, m.municipio FROM movimientos as m INNER JOIN empleados on idUsuario = empleados.id WHERE DATE(fechaHora) != DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) and m.municipio = ?"
    connection.query(query, municipio,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});
app.get("/movimientos-hoy/:municipio", (req, res) => {
    const municipio = req.params.municipio

    const query = "SELECT m.id, concepto, cantidad, fechaHora, nombre, m.municipio FROM movimientos as m INNER JOIN empleados on idUsuario = empleados.id WHERE DATE(fechaHora) = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) and m.municipio = ?"
    connection.query(query, municipio,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});


// Detalles de cobro de servicios y productos
app.get("/detalles-servicio/:id", (req, res) => {
    const id = req.params.id

    connection.query('SELECT d.id, cantidad, s.nombre, precioActual, puntosActual, e.nombre as barber FROM detallescobroservicios as d inner join servicios as s on idServicio = s.id left join empleados as e on idBarber = e.id WHERE idCobro=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.post("/create-detalle-servicio", (req, res) => {
    const idCobro = req.body.idCobro
    const idServicio = req.body.idServicio
    const cantidad = req.body.cantidad
    const precioActual = req.body.precioActual
    const puntosActual = req.body.puntosActual
    const idBarber = req.body.idBarber

    connection.query('INSERT INTO detallescobroservicios(idCobro, idServicio, cantidad, precioActual, puntosActual, idBarber) VALUES(?,?,?,?,?,?)',
        [idCobro, idServicio, cantidad, precioActual, puntosActual, idBarber],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/detalles-producto/:id", (req, res) => {
    const id = req.params.id

    connection.query('SELECT d.id, cantidad, p.nombre, precioActual, puntosActual, e.nombre as barber FROM detallescobroproductos as d inner join productos as p on idProducto = p.id left join empleados as e on idBarber = e.id WHERE idCobro=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.post("/create-detalle-producto", (req, res) => {
    const idCobro = req.body.idCobro
    const idProducto = req.body.idProducto
    const cantidad = req.body.cantidad
    const precioActual = req.body.precioActual
    const puntosActual = req.body.puntosActual
    const idBarber = req.body.idBarber

    connection.query('INSERT INTO detallescobroproductos(idCobro, idProducto, cantidad, precioActual, puntosActual, idBarber) VALUES(?,?,?,?,?,?)',
        [idCobro, idProducto, cantidad, precioActual, puntosActual, idBarber],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});


// Reportes
app.post("/create-reporte", (req, res) => {
    const idBarber = req.body.idBarber
    const montoEfectivo = req.body.montoEfectivo
    const montoElectronico = req.body.montoElectronico
    const montoPts = req.body.montoPts
    const municipio = req.body.municipio

    connection.query('INSERT INTO reportes(idBarber, montoEfectivo, montoElectronico, montoPts, municipio) VALUES(?,?,?,?,?)',
        [idBarber, montoEfectivo, montoElectronico, montoPts, municipio],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/reporte-hoy/:municipio", (req, res) => {
    const municipio = req.params.municipio

    connection.query("SELECT id FROM reportes WHERE DATE(fecha) = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) AND municipio = " + municipio,
        (err, result) => {
            err ? console.log(err) : res.send(result[0]);
        }
    );
})

//Horarios
app.get("/horarios", (req, res) => {
    connection.query('SELECT * FROM horarios',
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})
app.get("/horario/:id", (req, res) => {
    const id = req.params.id
    connection.query('SELECT * FROM horarios WHERE idBarber = ?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.post("/create-horario", (req, res) => {
    const idBarber = req.body.idBarber
    connection.query('INSERT INTO horarios(idBarber) VALUES(?)',
        [idBarber],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.put("/update-horario", (req, res) => {
    const idBarber = req.body.idBarber
    const lunIn = req.body.lunIn
    const lunOut = req.body.lunOut
    const marIn = req.body.marIn
    const marOut = req.body.marOut
    const mieIn = req.body.mieIn
    const mieOut = req.body.mieOut
    const jueIn = req.body.jueIn
    const jueOut = req.body.jueOut
    const vieIn = req.body.vieIn
    const vieOut = req.body.vieOut
    const sabIn = req.body.sabIn
    const sabOut = req.body.sabOut
    const domIn = req.body.domIn
    const domOut = req.body.domOut

    connection.query('UPDATE horarios SET lunIn=?, lunOut=?, marIn=?, marOut=?, mieIn=?,mieOut=?,jueIn=?,jueOut=?,vieIn=?,vieOut=?,sabIn=?,sabOut=?,domIn=?,domOut=? WHERE idBarber = ?',
        [lunIn, lunOut, marIn, marOut, mieIn, mieOut, jueIn, jueOut, vieIn, vieOut, sabIn, sabOut, domIn, domOut, idBarber],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

//Chequeos
app.get("/chequeos", (req, res) => {
    const query = 'SELECT dia, entrada, comidaInicio, comidaFin, salida, empleados.nombre from chequeos '
        + 'inner join empleados on idBarber = empleados.id order by dia desc LIMIT 50'
    connection.query(query, (err, result) => {
        err ? console.log(err) : res.send(result);
    }
    );
})

app.get("/chequeos-hoy", (req, res) => {
    const query = 'SELECT dia, entrada, comidaInicio, comidaFin, salida, empleados.nombre from chequeos '
        + "inner join empleados on idBarber = empleados.id WHERE DATE(dia) = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) order by dia desc"
    connection.query(query, (err, result) => {
        err ? console.log(err) : res.send(result);
    }
    );
});

app.get("/chequeo/:id", (req, res) => {
    const id = req.params.id
    connection.query("SELECT * FROM chequeos WHERE dia = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) AND idBarber = ?", id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.get("/descanso/:id", (req, res) => {
    const id = req.params.id
    connection.query("SELECT comidaInicio, comidaFin from chequeos WHERE dia = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) AND idBarber = ?", id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.post("/create-chequeos", (req, res) => {
    const idBarber = req.body.idBarber
    const municipio = req.body.municipio

    connection.query('INSERT INTO chequeos(idBarber, municipio) VALUES(?,?)',
        [idBarber, municipio],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});
app.put("/iniciar-descanso", (req, res) => {
    const idBarber = req.body.idBarber

    connection.query("UPDATE chequeos SET comidaInicio = TIME(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00'))  WHERE idBarber = ? AND dia = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00'))",
        [idBarber],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});
app.put("/finalizar-descanso", (req, res) => {
    const idBarber = req.body.idBarber

    connection.query("UPDATE chequeos SET comidaFin = TIME(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) WHERE idBarber = ? AND dia = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00'))",
        [idBarber],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});
app.put("/registrar-salida", (req, res) => {
    const idBarber = req.body.idBarber

    connection.query("UPDATE chequeos SET salida = TIME(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) WHERE idBarber = ? AND dia = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00'))",
        [idBarber],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});


app.listen(PORT, () => {
    console.log("Corriendo en el puerto " + PORT)
})