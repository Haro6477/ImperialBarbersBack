const express = require("express");
const app = express();
const mysql = require("mysql2");
const cors = require("cors");
const multer = require('multer')
const path = require('path')
const fs = require('fs');
const { PORT, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = require("./config");

app.use(cors({ credentials: true, origin: ['http://localhost:5173', 'http://192.168.1.120:5173', 'http://192.168.1.78:5173', 'http://192.168.1.67:5173', 'http://192.168.1.71:5173'] }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dbimages')))

// Conexión db
const db = mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: DB_PORT
});

// Función para autenticación
app.get("/auth/:user/:pass", (req, res) => {
    const usuario = req.params.user
    const pass = req.params.pass

    db.query('SELECT id FROM empleados WHERE usuario=? AND pass=?', [usuario, pass],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

// Funciones para los clientes
app.get("/clientes", (req, res) => {

    db.query('SELECT * FROM clientes order by nombre',
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

    db.query('INSERT INTO clientes(nombre,telefono,pts,genero,fechaNacimiento,codigoQR) VALUES(?,?,?,?,?,?)',
        [nombre, telefono, pts, genero, fechaNacimiento, codigoQR],
        (err, result) => {
            err ? console.log(err) : res.send(result);
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

    db.query('UPDATE clientes SET nombre=?,telefono=?,pts=?,genero=?,fechaNacimiento=?,codigoQR=? WHERE id=?',
        [nombre, telefono, pts, genero, fechaNacimiento, codigoQR, id],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.delete("/delete-cliente/:id", (req, res) => {
    const id = req.params.id;

    db.query('DELETE FROM clientes WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/cliente/:id", (req, res) => {
    const id = req.params.id

    db.query('SELECT * FROM clientes WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

// Funciones para los empleados
app.get("/empleados", (req, res) => {

    db.query('SELECT id, usuario, pass, nombre, telefono, correo, fechaNacimiento, fechaInicio, puesto, estatus, color FROM empleados order by nombre',
        (err, rows) => {
            if (err) { console.log(err) }
            else {
                res.send(rows)
            }
        }
    );
});

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
    var lunes = new Date().toLocaleDateString('es-mx');
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);
    const expresion = 'SELECT ds.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, ds.precioActual, ds.cantidad, s.nombre AS servicio FROM detallescobroservicios AS ds '
        + ' INNER JOIN cobros AS c ON ds.idCobro = c.id'
        + ' INNER JOIN clientes AS cl ON c.idCliente = cl.id'
        + ' INNER JOIN empleados AS e ON ds.idBarber = e.id'
        + ' INNER JOIN servicios AS s ON ds.idServicio = s.id'
        + " WHERE fecha < '" + formatearFecha(lunes) + "' AND c.idCliente != '122' AND ds.idBarber = " + id
        + ' order by fecha desc'
    db.query(expresion,
        (err, rows) => {
            if (err) { console.log(err) }
            else {
                res.send(rows)
            }
        })
})
app.get("/servicios-semana", (req, res) => {
    var lunes = new Date().toLocaleDateString('es-mx');
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);
    const expresion = 'SELECT ds.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, ds.precioActual, ds.cantidad, s.nombre AS servicio FROM detallescobroservicios AS ds '
        + ' INNER JOIN cobros AS c ON ds.idCobro = c.id'
        + ' INNER JOIN clientes AS cl ON c.idCliente = cl.id'
        + ' INNER JOIN empleados AS e ON ds.idBarber = e.id'
        + ' INNER JOIN servicios AS s ON ds.idServicio = s.id'
        + " WHERE fecha >= '" + formatearFecha(lunes) + "' AND c.idCliente != '122'"
        + ' order by fecha desc'
    db.query(expresion,
        (err, rows) => {
            if (err) { console.log(err) }
            else {
                res.send(rows)
            }
        })
})
app.get("/servicios-semana/:id", (req, res) => {
    const id = req.params.id
    var lunes = new Date().toLocaleDateString('es-mx');
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);

    const expresion = 'SELECT ds.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, ds.precioActual, ds.cantidad, s.nombre AS servicio FROM detallescobroservicios AS ds '
        + ' INNER JOIN cobros AS c ON ds.idCobro = c.id'
        + ' INNER JOIN clientes AS cl ON c.idCliente = cl.id'
        + ' INNER JOIN empleados AS e ON ds.idBarber = e.id'
        + ' INNER JOIN servicios AS s ON ds.idServicio = s.id'
        + " WHERE fecha >= '" + formatearFecha(lunes) + "' AND c.idCliente != '122' AND ds.idBarber = " + id
        + ' order by fecha desc'
    db.query(expresion,
        (err, rows) => {
            if (err) { console.log(err) }
            else {
                res.send(rows)
            }
        })
})
app.get("/productos-semana-all/:id", (req, res) => {
    const id = req.params.id
    var lunes = new Date().toLocaleDateString('es-mx');
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);
    const expresion = 'SELECT dp.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, dp.precioActual, dp.cantidad, p.nombre AS producto FROM detallescobroproductos AS dp '
        + ' INNER JOIN cobros AS c ON dp.idCobro = c.id'
        + ' INNER JOIN clientes AS cl ON c.idCliente = cl.id'
        + ' INNER JOIN empleados AS e ON dp.idBarber = e.id'
        + ' INNER JOIN productos AS p ON dp.idProducto = p.id'
        + " WHERE fecha < '" + formatearFecha(lunes) + "' AND c.idCliente != '122' AND dp.idBarber = " + id
        + ' order by fecha desc'
    db.query(expresion,
        (err, rows) => {
            if (err) { console.log(err) }
            else {
                res.send(rows)
            }
        })
})
app.get("/productos-semana", (req, res) => {
    var lunes = new Date().toLocaleDateString('es-mx');
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);
    const expresion = 'SELECT dp.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, dp.precioActual, dp.cantidad, p.nombre AS producto FROM detallescobroproductos AS dp '
        + ' INNER JOIN cobros AS c ON dp.idCobro = c.id'
        + ' INNER JOIN clientes AS cl ON c.idCliente = cl.id'
        + ' INNER JOIN empleados AS e ON dp.idBarber = e.id'
        + ' INNER JOIN productos AS p ON dp.idProducto = p.id'
        + " WHERE fecha >= '" + formatearFecha(lunes) + "' AND c.idCliente != '122'"
        + ' order by fecha desc'
    db.query(expresion,
        (err, rows) => {
            if (err) { console.log(err) }
            else {
                res.send(rows)
            }
        })
})
app.get("/productos-semana/:id", (req, res) => {
    const id = req.params.id
    var lunes = new Date().toLocaleDateString('es-mx');
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);
    const expresion = 'SELECT dp.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, dp.precioActual, dp.cantidad, p.nombre AS producto FROM detallescobroproductos AS dp '
        + ' INNER JOIN cobros AS c ON dp.idCobro = c.id'
        + ' INNER JOIN clientes AS cl ON c.idCliente = cl.id'
        + ' INNER JOIN empleados AS e ON dp.idBarber = e.id'
        + ' INNER JOIN productos AS p ON dp.idProducto = p.id'
        + " WHERE fecha >= '" + formatearFecha(lunes) + "' AND c.idCliente != '122' AND dp.idBarber = " + id
        + ' order by fecha desc'
    db.query(expresion,
        (err, rows) => {
            if (err) { console.log(err) }
            else {
                res.send(rows)
            }
        })
})

app.get("/fotos-empleados", (req, res) => {

    db.query('SELECT id, foto FROM empleados',
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
    db.query('SELECT id, foto FROM empleados WHERE id = ?', id,
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

    db.query('INSERT INTO empleados(usuario,pass,nombre,telefono,correo,fechaNacimiento,fechaInicio,puesto,estatus,foto) VALUES(?,?,?,?,?,?,?,?,?,?)',
        [usuario, pass, nombre, telefono, correo, fechaNacimiento, fechaInicio, puesto, estatus, foto],
        (err, result) => {
            err ? console.log(err) : res.send(result);
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

    db.query('UPDATE empleados SET usuario=?,pass=?,nombre=?,telefono=?,correo=?,fechaNacimiento=?,fechaInicio=?,puesto=?,estatus=? WHERE id=?',
        [usuario, pass, nombre, telefono, correo, fechaNacimiento, fechaInicio, puesto, estatus, id],
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

    db.query('UPDATE empleados SET usuario=?,nombre=?,telefono=?,correo=?,fechaNacimiento=?, color=? WHERE id=?',
        [usuario, nombre, telefono, correo, fechaNacimiento, color, id],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});
app.put("/update-password", (req, res) => {
    const id = req.body.id
    const pass = req.body.pass
    db.query('UPDATE empleados SET pass=? WHERE id=?',
        [pass, id],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});


const diskStorage = multer.diskStorage({
    destination: path.join(__dirname, './images'),
    filename: (req, file, cb) => {
        cb(null, new Date().toLocaleDateString('es-mx') + file.originalname)
    }
})

const fileUpload = multer({
    storage: diskStorage
}).single('image')

app.put('/add-foto-empleado', fileUpload, (req, res) => {
    console.log('file:  ' + req.file)
    console.log('body:  ' + req.body.idn)
    // const type = req.file.mimetype
    // const name = req.file.originalname
    // const data = fs.readFileSync(path.join(__dirname, './images/' + req.file.filename))

    // db.query('INSERT INTO fotosempleados set ?', [{ type, name, data }], (err, rows) => {
    //     if (err) return res.status(500).send('server error')
    //     res.send('¡Foto guardada!')
    // })
})

app.put('/update-foto-empleado', fileUpload, (req, res) => {
    const id = req.body.id
    const type = req.file.mimetype
    const name = req.file.originalname
    const data = fs.readFileSync(path.join(__dirname, './images/' + req.file.filename))

    db.query('UPDATE empleados set foto = ? WHERE id = ?', [data, id], (err, result) => {
        if (err) return res.status(500).send('server error')
        else res.send("Foto actualizada\nActualizar para mostrar cambios")
    })
})

app.delete("/delete-empleado/:id", (req, res) => {
    const id = req.params.id;

    db.query('DELETE FROM empleados WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});


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

    db.query('INSERT INTO empleados(usuario,pass,nombre,telefono,correo,fechaNacimiento,fechaInicio,puesto,estatus,foto) VALUES(?,?,?,?,?,?,?,?,?,?)',
        [usuario, pass, nombre, telefono, correo, fechaNacimiento, fechaInicio, puesto, estatus, foto],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});


app.delete("/delete-empleado/:id", (req, res) => {
    const id = req.params.id;

    db.query('DELETE FROM empleados WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/empleado/:id", (req, res) => {
    const id = req.params.id

    db.query('SELECT usuario, pass, nombre, telefono, correo, fechaNacimiento, fechaInicio, fechaInicio, puesto, estatus, color FROM empleados WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

// Funciones para los servicios
app.get("/servicios", (req, res) => {

    db.query('SELECT * FROM servicios order by nombre',
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

    db.query('INSERT INTO servicios(nombre,descripcion,precio,pts) VALUES(?,?,?,?)',
        [nombre, descripcion, precio, pts],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.put("/update-servicio", (req, res) => {
    const id = req.body.id
    const nombre = req.body.nombre
    const descripcion = req.body.descripcion
    const precio = req.body.precio
    const pts = req.body.pts

    db.query('UPDATE servicios SET nombre=?,descripcion=?,precio=?,pts=? WHERE id=?',
        [nombre, descripcion, precio, pts, id],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.delete("/delete-servicio/:id", (req, res) => {
    const id = req.params.id;

    db.query('DELETE FROM servicios WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/servicio/:id", (req, res) => {
    const id = req.params.id

    db.query('SELECT * FROM servicios WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

// Funciones para los productos
app.get("/productos", (req, res) => {

    db.query('SELECT * FROM productos order by nombre',
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
    db.query('INSERT INTO productos(nombre,marca,linea,contenido,enVenta,suministros,almacen,descripcion,costo,precio,pts,imagen) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        [nombre, marca, linea, contenido, enVenta, suministros, almacen, descripcion, costo, precio, pts, imagen],
        (err, result) => {
            err ? console.log(err) : res.send(result);
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

    db.query('UPDATE productos SET nombre=?,marca=?,linea=?,contenido=?,enVenta=?,suministros=?,almacen=?,descripcion=?,costo=?,precio=?,pts=?,imagen=? WHERE id=?',
        [nombre, marca, linea, contenido, enVenta, suministros, almacen, descripcion, costo, precio, pts, imagen, id],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.delete("/delete-producto/:id", (req, res) => {
    const id = req.params.id;

    db.query('DELETE FROM productos WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/producto/:id", (req, res) => {
    const id = req.params.id

    db.query('SELECT * FROM productos WHERE id=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

// Permisos
app.get("/permisos", (req, res) => {
    db.query('SELECT * FROM permisos order by permiso',
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.get("/permisos-usuario/:id", (req, res) => {
    const id = req.params.id

    db.query('SELECT permiso FROM permisos WHERE idEmpleado=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.post("/create-permiso", (req, res) => {
    const permiso = req.body.permiso
    const idEmpleado = req.body.idEmpleado
    db.query('INSERT INTO permisos(permiso, idEmpleado) VALUES(?,?)',
        [permiso, idEmpleado],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.delete("/delete-permisos/:id", (req, res) => {
    const id = req.params.id;

    db.query('DELETE FROM permisos WHERE idEmpleado=?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});


// Funciones para los cobros o ventas
app.get("/cobros", (req, res) => {

    const query = 'SELECT v.id, c.nombre as cliente, total, descuento, subtotal, totalPuntos, metodoPago, b.nombre as barber, s.nombre as cobrador, fecha, pagoEfectivo, pagoTarjeta, pagoPuntos '
        + 'from cobros as v '
        + 'inner join clientes as c on v.idCliente = c.id '
        + 'inner join empleados as b on v.idBarber = b.id '
        + 'inner join empleados as s on v.idCobrador = s.id order by fecha desc'
    db.query(query,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/cobros-hoy", (req, res) => {

    const query = 'SELECT v.id, c.nombre as cliente, total, descuento, subtotal, totalPuntos, metodoPago, b.nombre as barber, s.nombre as cobrador, fecha, pagoEfectivo, pagoTarjeta, pagoPuntos '
        + 'from cobros as v '
        + 'inner join clientes as c on v.idCliente = c.id '
        + 'inner join empleados as b on v.idBarber = b.id '
        + "inner join empleados as s on v.idCobrador = s.id WHERE DATE(fecha) = DATE(DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00'))) order by fecha desc"
    db.query(query,
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
    db.query(query, id,
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
    db.query('INSERT INTO cobros(idCliente,total,descuento,subtotal,totalPuntos,metodoPago,idBarber,idCobrador,pagoEfectivo,pagoTarjeta,pagoPuntos) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        [idCliente, total, descuento, subtotal, totalPuntos, metodoPago, idBarber, idCobrador, pagoEfectivo, pagoTarjeta, pagoPuntos],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

// Inventario puntos y caja
app.get("/caja", (req, res) => {

    const query = 'SELECT * FROM caja'
    db.query(query,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.put("/update-caja", (req, res) => {
    const efectivo = req.body.efectivo
    const dineroElectronico = req.body.dineroElectronico
    const puntos = req.body.puntos

    db.query('UPDATE caja SET efectivo=efectivo+?, dineroElectronico=dineroElectronico+?, puntos=puntos+? WHERE id=1',
        [efectivo, dineroElectronico, puntos],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});


app.put("/update-cliente-pts", (req, res) => {
    const id = req.body.id
    const pts = req.body.pts

    db.query('UPDATE clientes SET pts=pts+? WHERE id=?',
        [pts, id],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.put("/update-inventario", (req, res) => {
    const id = req.body.id
    const cantidad = req.body.cantidad

    db.query('UPDATE productos SET enVenta=enVenta+? WHERE id=?',
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
    db.query('INSERT INTO movimientos(concepto,cantidad,idUsuario) VALUES(?,?,?)',
        [concepto, cantidad, idUsuario],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/movimientos", (req, res) => {

    const query = "SELECT m.id, concepto, cantidad, fechaHora, nombre FROM movimientos as m INNER JOIN empleados on idUsuario = empleados.id WHERE DATE(fechaHora) != DATE(DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')))"
    db.query(query,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});
app.get("/movimientos-hoy", (req, res) => {

    const query = "SELECT m.id, concepto, cantidad, fechaHora, nombre FROM movimientos as m INNER JOIN empleados on idUsuario = empleados.id WHERE DATE(fechaHora) = DATE(DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')))"
    db.query(query,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});


// Detalles de cobro de servicios y productos
app.get("/detalles-servicio/:id", (req, res) => {
    const id = req.params.id

    db.query('SELECT d.id, cantidad, s.nombre, precioActual, puntosActual, e.nombre as barber FROM detallescobroservicios as d inner join servicios as s on idServicio = s.id left join empleados as e on idBarber = e.id WHERE idCobro=?', id,
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

    db.query('INSERT INTO detallescobroservicios(idCobro, idServicio, cantidad, precioActual, puntosActual, idBarber) VALUES(?,?,?,?,?,?)',
        [idCobro, idServicio, cantidad, precioActual, puntosActual, idBarber],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/detalles-producto/:id", (req, res) => {
    const id = req.params.id

    db.query('SELECT d.id, cantidad, p.nombre, precioActual, puntosActual, e.nombre as barber FROM detallescobroproductos as d inner join productos as p on idProducto = p.id left join empleados as e on idBarber = e.id WHERE idCobro=?', id,
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

    db.query('INSERT INTO detallescobroproductos(idCobro, idProducto, cantidad, precioActual, puntosActual, idBarber) VALUES(?,?,?,?,?,?)',
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

    db.query('INSERT INTO reportes(idBarber, montoEfectivo, montoElectronico, montoPts) VALUES(?,?,?,?)',
        [idBarber, montoEfectivo, montoElectronico, montoPts],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

//Horarios
app.get("/horarios", (req, res) => {
    db.query('SELECT * FROM horarios',
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})
app.get("/horario/:id", (req, res) => {
    const id = req.params.id
    db.query('SELECT * FROM horarios WHERE idBarber = ?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.post("/create-horario", (req, res) => {
    const idBarber = req.body.idBarber
    db.query('INSERT INTO horarios(idBarber) VALUES(?)',
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

    db.query('UPDATE horarios SET lunIn=?, lunOut=?, marIn=?, marOut=?, mieIn=?,mieOut=?,jueIn=?,jueOut=?,vieIn=?,vieOut=?,sabIn=?,sabOut=?,domIn=?,domOut=? WHERE idBarber = ?',
        [lunIn, lunOut, marIn, marOut, mieIn, mieOut, jueIn, jueOut, vieIn, vieOut, sabIn, sabOut, domIn, domOut, idBarber],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

//Chequeos
app.get("/chequeos", (req, res) => {
    const query = 'SELECT dia, entrada, comidaInicio, comidaFin, salida, empleados.nombre from chequeos '
        + 'inner join empleados on idBarber = empleados.id order by dia desc'
    db.query(query, (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.get("/chequeos-hoy", (req, res) => {
    const query = 'SELECT dia, entrada, comidaInicio, comidaFin, salida, empleados.nombre from chequeos '
        + "inner join empleados on idBarber = empleados.id WHERE DATE(dia) = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) order by dia desc"
    db.query(query, (err, result) => {
        err ? console.log(err) : res.send(result);
    }
    );
});

app.get("/chequeo/:id", (req, res) => {
    const id = req.params.id
    db.query("SELECT * FROM chequeos WHERE dia = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) AND idBarber = ?", id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.get("/descanso/:id", (req, res) => {
    const id = req.params.id
    db.query("SELECT comidaInicio, comidaFin from chequeos WHERE dia = DATE(DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00'))) AND idBarber = ?", id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.post("/create-chequeos", (req, res) => {
    const idBarber = req.body.idBarber

    db.query('INSERT INTO chequeos(idBarber) VALUES(?)',
        [idBarber],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});
app.put("/iniciar-descanso", (req, res) => {
    const idBarber = req.body.idBarber
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' }
    const dia = (new Date).toLocaleDateString('es-mx', options).split('/').reverse().join('-')
    const comidaInicio = (new Date).toLocaleTimeString()

    db.query('UPDATE chequeos SET comidaInicio=? WHERE idBarber = ? AND dia = ?',
        [comidaInicio, idBarber, dia],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});
app.put("/finalizar-descanso", (req, res) => {
    const idBarber = req.body.idBarber
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' }
    const dia = (new Date).toLocaleDateString('es-mx', options).split('/').reverse().join('-')
    const comidaFin = (new Date).toLocaleTimeString('es-mx')

    db.query('UPDATE chequeos SET comidaFin=? WHERE idBarber = ? AND dia = ?',
        [comidaFin, idBarber, dia],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});
app.put("/registrar-salida", (req, res) => {
    const idBarber = req.body.idBarber
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' }
    const dia = (new Date).toLocaleDateString('es-mx', options).split('/').reverse().join('-')
    const salida = (new Date).toLocaleTimeString('es-mx')

    db.query('UPDATE chequeos SET salida=? WHERE idBarber = ? AND dia = ?',
        [salida, idBarber, dia],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});


app.listen(PORT, () => {
    console.log("Corriendo en el puerto " + PORT)
})