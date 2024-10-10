const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const multer = require('multer')
const path = require('path')
const fs = require('fs');
const sharp = require('sharp');
const postgres = require('postgres');

// Crear una instancia de express
const app = express();

const { host, username, password, database, port } = require("./config");
const options = { year: 'numeric', month: '2-digit', day: '2-digit' }
const options2 = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }

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
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');


// Conexión db
const db_config = {
    host: host,
    user: username,
    password: password,
    database: database,
    port: port,
    ssl: {
        rejectUnauthorized: false
    }
}

const sql = postgres(db_config);

// Home
app.get('/', (req, res) => {
    const { pass, ...rest } = sql.options;
    res.send(`¡Bienvenido Barber!\n\nDatos de la conexión:\n${JSON.stringify(rest)}`);
});


app.get('/animation', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'animation.html'));
});

// Función para autenticación
app.get("/auth/:user/:pass", async (req, res) => {
    const usuario = req.params.user
    const pass = req.params.pass

    try {
        const result = await sql`SELECT id, puesto FROM empleados 
            WHERE usuario = ${usuario} 
              AND pass = ${pass}
        `;
        res.send(result);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send('Error interno del servidor');
    }
})

app.put("/cambio-municipio", async (req, res) => {
    const id = req.body.id
    const municipio = req.body.municipio
    try {
        const result = await sql`
            UPDATE empleados 
            SET municipio = ${municipio} 
            WHERE id = ${id}
            RETURNING *
        `;
        res.send(result);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send('Error interno del servidor');
    }
})

// Funciones para los clientes
app.get('/puntos/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const result = await sql`
            SELECT clientes.pts, clientes.nombre, cobros.fecha 
            FROM clientes 
            INNER JOIN cobros ON cobros.idCliente = clientes.id 
            WHERE clientes.id = ${id} 
            ORDER BY cobros.fecha DESC 
            LIMIT 1
        `;

        if (result.length > 0) {
            let data = result[0];
            data.fecha = new Date(data.fecha).toLocaleDateString('es-MX', options2);
            res.render('puntos', { data: data });
        } else {
            res.send('No data found');
        }
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send('Error interno del servidor');
    }
});


app.get("/clientes", async (req, res) => {
    try {
        const result = await sql`SELECT * FROM clientes order by nombre`;
        res.send(result);
    } catch (error) {
        console.error('Error executing query', error.stack);
        res.status(500).send('Error interno del servidor');
    }
});


app.get("/clientes/:municipio", async (req, res) => {
    const municipio = req.params.municipio;

    try {
        const result = await sql`SELECT * FROM clientes where municipio = ${municipio} order by nombre`;
        res.send(result);
    } catch (error) {
        console.error('Error executing query', error.stack);
        res.status(500).send('Error interno del servidor');
    }
});

app.post("/create-cliente", async (req, res) => {
    const nombre = req.body.nombre;
    const telefono = req.body.telefono;
    const pts = req.body.pts;
    const genero = req.body.genero;
    const fechaNacimiento = req.body.fechaNacimiento;
    const codigoQR = req.body.codigoQR;
    const municipio = req.body.municipio;

    try {
        // Inserta y retorna todos los campos del nuevo cliente
        const result = await sql`
            INSERT INTO clientes (nombre, telefono, pts, genero, fechaNacimiento, codigoQR, municipio)
            VALUES (${nombre}, ${telefono}, ${pts}, ${genero}, ${fechaNacimiento}, ${codigoQR}, ${municipio})
            RETURNING *
        `;

        res.send(result[0]); // Enviar los datos del nuevo cliente
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al insertar el cliente");
    }
});


app.put("/update-cliente", async (req, res) => {
    const id = req.body.id;
    const nombre = req.body.nombre;
    const telefono = req.body.telefono;
    const pts = req.body.pts;
    const genero = req.body.genero;
    const fechaNacimiento = req.body.fechaNacimiento;
    const codigoQR = req.body.codigoQR;
    const municipio = req.body.municipio;

    try {
        const result = await sql`
            UPDATE clientes 
            SET nombre = ${nombre}, telefono = ${telefono}, pts = ${pts}, genero = ${genero}, 
                fechaNacimiento = ${fechaNacimiento}, codigoQR = ${codigoQR}, municipio = ${municipio}
            WHERE id = ${id}
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al actualizar el cliente");
    }
});


app.delete("/delete-cliente/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const result = await sql`
            DELETE FROM clientes 
            WHERE id = ${id}
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al eliminar el cliente");
    }
});


app.get("/cliente/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const result = await sql`
            SELECT * FROM clientes 
            WHERE id = ${id}
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener el cliente");
    }
});

app.get("/cuentas", async (req, res) => {
    try {
        const result = await sql`SELECT idCliente FROM cuentas`;
        res.send(result);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener las cuentas");
    }
});


app.get("/cuentas/:idCliente", async (req, res) => {
    const idCliente = req.params.idCliente;

    try {
        const result = await sql`
            SELECT * FROM cuentas 
            WHERE idCliente = ${idCliente}
        `;
        res.send(result);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener la cuenta");
    }
});


app.post("/create-cuenta", async (req, res) => {
    const { idCliente, idCobro, descripcion } = req.body;

    try {
        const result = await sql`
            INSERT INTO cuentas (idCliente, idCobro, descripcion)
            VALUES (${idCliente}, ${idCobro}, ${descripcion})
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al insertar cuenta', err.stack);
        res.status(500).send("Error al insertar cuenta");
    }
});


app.put("/update-cuenta", async (req, res) => {
    const idCuenta = req.body.idCuenta;
    const estatus = req.body.estatus;

    try {
        const result = await sql`
            UPDATE cuentas 
            SET estatus = ${estatus} 
            WHERE idCuenta = ${idCuenta}
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error ejecutando query', err.stack);
        res.status(500).send("Error al actualizar la cuenta");
    }
});


// Funciones para los empleados
app.get("/empleados", async (req, res) => {
    try {
        const result = await sql`
            SELECT id, usuario, pass, nombre, telefono, correo, fechaNacimiento, fechaInicio, puesto, estatus, color, municipio 
            FROM empleados 
            WHERE id <> 7 
            ORDER BY nombre
        `;
        res.send(result);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener los empleados");
    }
});


app.get("/empleados/:municipio", async (req, res) => {
    const municipio = req.params.municipio;

    try {
        const result = await sql`
            SELECT id, usuario, pass, nombre, telefono, correo, fechaNacimiento, fechaInicio, puesto, estatus, color, municipio 
            FROM empleados 
            WHERE municipio = ${municipio}
            ORDER BY nombre
        `;
        res.send(result);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener los empleados por municipio");
    }
});


const formatearFechaHora = (fecha) => {
    const date = new Date(fecha);
    const yyyy = date.getFullYear()
    let mm = date.getMonth() + 1
    let dd = date.getDate()

    if (dd < 10) dd = '0' + dd
    if (mm < 10) mm = '0' + mm

    const fechaFormateada = yyyy + '-' + mm + '-' + dd + ' 00:00:00';
    return fechaFormateada
}

const formatearFecha = (fecha) => {
    const date = new Date(fecha);
    const yyyy = date.getFullYear()
    let mm = date.getMonth() + 1
    let dd = date.getDate()

    if (dd < 10) dd = '0' + dd
    if (mm < 10) mm = '0' + mm

    const fechaFormateada = yyyy + '-' + mm + '-' + dd;
    return fechaFormateada
}

app.get("/servicios-semana-all/:id", async (req, res) => {
    const id = req.params.id;
    const now = new Date().toLocaleDateString('es-MX', options).split('/').reverse().join('-');
    const lunes = new Date(now + 'T00:00:00');
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);

    try {
        const result = await sql`
            SELECT ds.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, ds.precioActual, ds.cantidad, s.nombre AS servicio 
            FROM detallescobroservicios AS ds
            INNER JOIN cobros AS c ON ds.idCobro = c.id
            INNER JOIN clientes AS cl ON c.idCliente = cl.id
            INNER JOIN empleados AS e ON ds.idBarber = e.id
            INNER JOIN servicios AS s ON ds.idServicio = s.id
            WHERE c.fecha < ${lunes} AND c.idCliente != '122' AND ds.idBarber = ${id}
            ORDER BY c.fecha DESC
        `;
        res.send(result);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener los servicios de la semana para el barber.");
    }
});

app.get("/servicios-semana", async (req, res) => {
    const now = new Date().toLocaleDateString('es-MX', options).split('/').reverse().join('-');
    const lunes = new Date(now + 'T00:00:00');
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);

    try {
        const result = await sql`
            SELECT ds.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, ds.precioActual, ds.cantidad, s.nombre AS servicio 
            FROM detallescobroservicios AS ds
            INNER JOIN cobros AS c ON ds.idCobro = c.id
            INNER JOIN clientes AS cl ON c.idCliente = cl.id
            INNER JOIN empleados AS e ON ds.idBarber = e.id
            INNER JOIN servicios AS s ON ds.idServicio = s.id
            WHERE c.fecha >= ${lunes} AND c.idCliente != '122'
            ORDER BY c.fecha DESC
        `;
        res.send(result);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener los servicios de la semana.");
    }
});

app.get("/servicios-semana/:id", async (req, res) => {
    const id = req.params.id;
    const now = new Date().toLocaleDateString('es-MX', options).split('/').reverse().join('-');
    const lunes = new Date(now + 'T00:00:00');
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);

    try {
        const result = await sql`
            SELECT ds.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, ds.precioActual, ds.cantidad, s.nombre AS servicio 
            FROM detallescobroservicios AS ds
            INNER JOIN cobros AS c ON ds.idCobro = c.id
            INNER JOIN clientes AS cl ON c.idCliente = cl.id
            INNER JOIN empleados AS e ON ds.idBarber = e.id
            INNER JOIN servicios AS s ON ds.idServicio = s.id
            WHERE c.fecha >= ${lunes} AND c.idCliente != '122' AND ds.idBarber = ${id}
            ORDER BY c.fecha DESC
        `;
        res.send(result);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener los servicios de la semana para el barber.");
    }
});

app.get("/productos-semana-all/:id", async (req, res) => {
    const id = req.params.id;
    const now = new Date().toLocaleDateString('es-MX', options).split('/').reverse().join('-');
    const lunes = new Date(now + 'T00:00:00');
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);

    try {
        const result = await sql`
            SELECT dp.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, dp.precioActual, dp.cantidad, p.nombre AS producto
            FROM detallescobroproductos AS dp
            INNER JOIN cobros AS c ON dp.idCobro = c.id
            INNER JOIN clientes AS cl ON c.idCliente = cl.id
            INNER JOIN empleados AS e ON dp.idBarber = e.id
            INNER JOIN productos AS p ON dp.idProducto = p.id
            WHERE c.fecha < ${lunes} AND c.idCliente != '122' AND dp.idBarber = ${id}
            ORDER BY c.fecha DESC
        `;
        res.send(result);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener los productos de la semana para el barber.");
    }
});

app.get("/productos-semana", async (req, res) => {
    const now = new Date().toLocaleDateString('es-MX', options).split('/').reverse().join('-');
    const lunes = new Date(now + 'T00:00:00');
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);

    try {
        const result = await sql`
            SELECT dp.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, dp.precioActual, dp.cantidad, p.nombre AS producto
            FROM detallescobroproductos AS dp
            INNER JOIN cobros AS c ON dp.idCobro = c.id
            INNER JOIN clientes AS cl ON c.idCliente = cl.id
            INNER JOIN empleados AS e ON dp.idBarber = e.id
            INNER JOIN productos AS p ON dp.idProducto = p.id
            WHERE c.fecha >= ${lunes} AND c.idCliente != '122'
            ORDER BY c.fecha DESC
        `;
        res.send(result);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener los productos de la semana.");
    }
});

app.get("/productos-semana/:id", async (req, res) => {
    const id = req.params.id;
    const now = new Date().toLocaleDateString('es-MX', options).split('/').reverse().join('-');
    const lunes = new Date(now + 'T00:00:00');
    var nDay = (lunes.getDay() == 0) ? 6 : lunes.getDay() - 1;
    lunes.setDate(lunes.getDate() - nDay);

    try {
        const result = await sql`
            SELECT dp.id, e.nombre AS barber, e.color, e.id AS idBarber, cl.nombre AS cliente, c.fecha, dp.precioActual, dp.cantidad, p.nombre AS producto
            FROM detallescobroproductos AS dp
            INNER JOIN cobros AS c ON dp.idCobro = c.id
            INNER JOIN clientes AS cl ON c.idCliente = cl.id
            INNER JOIN empleados AS e ON dp.idBarber = e.id
            INNER JOIN productos AS p ON dp.idProducto = p.id
            WHERE c.fecha >= ${lunes} AND c.idCliente != '122' AND dp.idBarber = ${id}
            ORDER BY c.fecha DESC
        `;
        res.send(result);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener los productos de la semana para el barber.");
    }
});

app.get("/fotos-empleados", async (req, res) => {
    try {
        const result = await sql`SELECT id, foto FROM empleados`;
        result.map(img => {
            if (img.foto)
                fs.writeFileSync(path.join(__dirname, './dbimages/empleado' + img.id + '.webp'), img.foto);
        });
        const imagedir = fs.readdirSync(path.join(__dirname, './dbimages/'));
        res.json(imagedir);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener las fotos de los empleados.");
    }
});


app.get("/foto-empleado/:id", async (req, res) => {
    const id = req.params.id;
    try {
        const result = await sql`SELECT id, foto FROM empleados WHERE id = ${id}`;
        if (result[0].foto) {
            const dir = path.join(__dirname, './dbimages');

            if (!fs.existsSync(dir)) fs.mkdirSync(dir);

            fs.writeFileSync(path.join(dir, 'empleado' + result[0].id + '.webp'), result[0].foto);
            res.json('empleado' + result[0].id + '.webp');
        } else {
            res.json(null);
        }
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener la foto del empleado.");
    }
});


app.post("/create-empleado", async (req, res) => {
    const { usuario, pass, nombre, telefono, correo, fechaNacimiento, fechaInicio, puesto, estatus, foto, municipio } = req.body;
    try {
        const result = await sql`
            INSERT INTO empleados (usuario, pass, nombre, telefono, correo, fechaNacimiento, fechaInicio, puesto, estatus, foto, municipio)
            VALUES (${usuario}, ${pass}, ${nombre}, ${telefono}, ${correo}, ${fechaNacimiento}, ${fechaInicio}, ${puesto}, ${estatus}, ${foto}, ${municipio})
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al insertar el empleado', err.stack);
        res.status(500).send("Error al insertar el empleado");
    }
});


app.put("/update-empleado", async (req, res) => {
    const { id, usuario, pass, nombre, telefono, correo, fechaNacimiento, fechaInicio, puesto, estatus, municipio } = req.body;

    try {
        const result = await sql`
            UPDATE empleados 
            SET usuario = ${usuario}, pass = ${pass}, nombre = ${nombre}, telefono = ${telefono}, correo = ${correo}, 
                fechaNacimiento = ${fechaNacimiento}, fechaInicio = ${fechaInicio}, puesto = ${puesto}, estatus = ${estatus}, municipio = ${municipio}
            WHERE id = ${id}
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al actualizar el empleado', err.stack);
        res.status(500).send("Error al actualizar el empleado");
    }
});

app.put("/update-empleado-datos", async (req, res) => {
    const { id, usuario, nombre, telefono, correo, fechaNacimiento, color, municipio } = req.body;

    try {
        const result = await sql`
            UPDATE empleados 
            SET usuario = ${usuario}, nombre = ${nombre}, telefono = ${telefono}, correo = ${correo}, 
                fechaNacimiento = ${fechaNacimiento}, color = ${color}, municipio = ${municipio}
            WHERE id = ${id}
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al actualizar los datos del empleado', err.stack);
        res.status(500).send("Error al actualizar los datos del empleado");
    }
});

app.put("/update-password", async (req, res) => {
    const { id, pass } = req.body;

    try {
        const result = await sql`
            UPDATE empleados 
            SET pass = ${pass}
            WHERE id = ${id}
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al actualizar la contraseña', err.stack);
        res.status(500).send("Error al actualizar la contraseña");
    }
});


app.put("/update-empleado-municipio", async (req, res) => {
    const { idBarber, municipio } = req.body;

    try {
        const result = await sql`
            UPDATE empleados 
            SET municipio = ${municipio}
            WHERE id = ${idBarber}
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al actualizar el municipio del empleado', err.stack);
        res.status(500).send("Error al actualizar el municipio del empleado");
    }
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


app.put('/update-foto-empleado', fileUpload, async (req, res) => {
    const { id } = req.body;
    const imagePath = path.join(__dirname, './images/' + req.file.filename);

    const width = 420;
    const format = 'webp';

    try {
        const data = await sharp(imagePath)
            .resize(width)
            .toFormat(format)
            .toBuffer();

        const result = await sql`
            UPDATE empleados 
            SET foto = ${data}
            WHERE id = ${id}
            RETURNING *
        `;
        res.send("Foto actualizada\nActualizar para mostrar cambios");
    } catch (err) {
        console.error('Error al actualizar la foto del empleado', err.stack);
        res.status(500).send('Error al procesar la imagen');
    }
});


app.delete("/delete-empleado/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const result = await sql`
            DELETE FROM empleados 
            WHERE id = ${id}
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al eliminar el empleado', err.stack);
        res.status(500).send("Error al eliminar el empleado");
    }
});


app.get("/empleado/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const result = await sql`
            SELECT usuario, pass, nombre, telefono, correo, fechaNacimiento, fechaInicio, puesto, estatus, color, municipio
            FROM empleados 
            WHERE id = ${id}
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener el empleado");
    }
});


// Funciones para los servicios
app.get("/servicios/:municipio", async (req, res) => {
    const municipio = req.params.municipio;

    try {
        const result = await sql`
            SELECT * 
            FROM servicios 
            WHERE municipio = ${municipio}
            ORDER BY nombre
        `;
        res.send(result);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener los servicios");
    }
});


app.post("/create-servicio", async (req, res) => {
    const { nombre, descripcion, precio, pts, municipio } = req.body;

    try {
        const result = await sql`
            INSERT INTO servicios (nombre, descripcion, precio, pts, municipio)
            VALUES (${nombre}, ${descripcion}, ${precio}, ${pts}, ${municipio})
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al insertar el servicio', err.stack);
        res.status(500).send("Error al insertar el servicio");
    }
});


app.put("/update-servicio", async (req, res) => {
    const { id, nombre, descripcion, precio, pts } = req.body;

    try {
        const result = await sql`
            UPDATE servicios 
            SET nombre = ${nombre}, descripcion = ${descripcion}, precio = ${precio}, pts = ${pts}
            WHERE id = ${id}
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al actualizar el servicio', err.stack);
        res.status(500).send("Error al actualizar el servicio");
    }
});


app.delete("/delete-servicio/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const result = await sql`
            DELETE FROM servicios 
            WHERE id = ${id}
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al eliminar el servicio', err.stack);
        res.status(500).send("Error al eliminar el servicio");
    }
});


app.get("/servicio/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const result = await sql`
            SELECT * 
            FROM servicios 
            WHERE id = ${id}
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al obtener el servicio', err.stack);
        res.status(500).send("Error al obtener el servicio");
    }
});

// Funciones para los productos
app.get("/productos/:municipio", async (req, res) => {
    const municipio = req.params.municipio;

    try {
        const result = await sql`
            SELECT * 
            FROM productos 
            WHERE municipio = ${municipio}
            ORDER BY nombre
        `;
        res.send(result);
    } catch (err) {
        console.error('Error al obtener los productos', err.stack);
        res.status(500).send("Error al obtener los productos");
    }
});


app.post("/create-producto", async (req, res) => {
    const { nombre, marca, linea, contenido, enVenta, suministros, almacen, descripcion, costo, precio, pts, imagen, municipio } = req.body;

    try {
        const result = await sql`
            INSERT INTO productos (nombre, marca, linea, contenido, enVenta, suministros, almacen, descripcion, costo, precio, pts, imagen, municipio)
            VALUES (${nombre}, ${marca}, ${linea}, ${contenido}, ${enVenta}, ${suministros}, ${almacen}, ${descripcion}, ${costo}, ${precio}, ${pts}, ${imagen}, ${municipio})
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al insertar el producto', err.stack);
        res.status(500).send("Error al insertar el producto");
    }
});


app.put("/update-producto", async (req, res) => {
    const { id, nombre, marca, linea, contenido, enVenta, suministros, almacen, descripcion, costo, precio, pts, imagen } = req.body;

    try {
        const result = await sql`
            UPDATE productos 
            SET nombre = ${nombre}, marca = ${marca}, linea = ${linea}, contenido = ${contenido}, enVenta = ${enVenta}, 
                suministros = ${suministros}, almacen = ${almacen}, descripcion = ${descripcion}, costo = ${costo}, 
                precio = ${precio}, pts = ${pts}, imagen = ${imagen}
            WHERE id = ${id}
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al actualizar el producto', err.stack);
        res.status(500).send("Error al actualizar el producto");
    }
});


app.delete("/delete-producto/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const result = await sql`
            DELETE FROM productos 
            WHERE id = ${id}
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al eliminar el producto', err.stack);
        res.status(500).send("Error al eliminar el producto");
    }
});


app.get("/producto/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const result = await sql`
            SELECT * 
            FROM productos 
            WHERE id = ${id}
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al obtener el producto', err.stack);
        res.status(500).send("Error al obtener el producto");
    }
});


app.get("/permisos-usuario/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const result = await sql`
            SELECT permiso 
            FROM permisos 
            WHERE idEmpleado = ${id}
        `;
        res.send(result);
    } catch (err) {
        console.error('Error al obtener los permisos del usuario', err.stack);
        res.status(500).send("Error al obtener los permisos del usuario");
    }
});


app.post("/create-permisos", async (req, res) => {
    const permisos = req.body.permisos;
    let values = permisos.map(permiso => `(${permiso.permiso}, ${permiso.idEmpleado})`).join(',');

    try {
        const result = await sql`
            INSERT INTO permisos (permiso, idEmpleado) 
            VALUES ${sql(values)}
            RETURNING *
        `;
        res.send(result);
    } catch (err) {
        console.error('Error al crear permisos', err.stack);
        res.status(500).send("Error al crear permisos");
    }
});


app.delete("/delete-permisos/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const result = await sql`
            DELETE FROM permisos 
            WHERE idEmpleado = ${id}
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al eliminar permisos', err.stack);
        res.status(500).send("Error al eliminar permisos");
    }
});



// Funciones para los cobros o ventas
app.get("/cobros/:municipio", (req, res) => {
    const municipio = req.params.municipio

    const query = 'SELECT v.id, c.nombre as cliente, total, descuento, subtotal, totalPuntos, metodoPago, b.nombre as barber, s.nombre as cobrador, fecha, pagoEfectivo, pagoTarjeta, pagoPuntos, v.municipio '
        + 'from cobros as v '
        + 'inner join clientes as c on v.idCliente = c.id '
        + 'inner join empleados as b on v.idBarber = b.id '
        + 'inner join empleados as s on v.idCobrador = s.id WHERE v.municipio = ' + municipio + ' order by fecha desc LIMIT 300'
    sql.query(query,
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
    sql.query(query,
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
    sql.query(query, id,
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
    sql.query('INSERT INTO cobros(idCliente,total,descuento,subtotal,totalPuntos,metodoPago,idBarber,idCobrador,pagoEfectivo,pagoTarjeta,pagoPuntos,municipio) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
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
    sql.query(query, municipio,
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

    sql.query('UPDATE caja SET efectivo=efectivo+?, dineroElectronico=dineroElectronico+?, puntos=puntos+? WHERE id=?',
        [efectivo, dineroElectronico, puntos, id],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});


app.put("/update-cliente-pts", (req, res) => {
    const id = req.body.id
    const pts = req.body.pts

    sql.query('UPDATE clientes SET pts=pts+? WHERE id=?',
        [pts, id],
        (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send("Error al actualizar puntos");
            } else {
                sql.query(
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

    sql.query('UPDATE productos SET enVenta=enVenta+? WHERE id=?',
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
    sql.query('INSERT INTO movimientos(concepto,cantidad,idUsuario,municipio) VALUES(?,?,?,?)',
        [concepto, cantidad, idUsuario, municipio],
        (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send("Error al insertar movimiento");
            } else {
                sql.query(
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
    sql.query(query, municipio,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});
app.get("/movimientos-hoy/:municipio", (req, res) => {
    const municipio = req.params.municipio

    const query = "SELECT m.id, concepto, cantidad, fechaHora, nombre, m.municipio FROM movimientos as m INNER JOIN empleados on idUsuario = empleados.id WHERE DATE(fechaHora) = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) and m.municipio = ?"
    sql.query(query, municipio,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});


// Detalles de cobro de servicios y productos
app.get("/detalles-servicio/:id", (req, res) => {
    const id = req.params.id

    sql.query('SELECT d.id, cantidad, s.nombre, precioActual, puntosActual, e.nombre as barber FROM detallescobroservicios as d inner join servicios as s on idServicio = s.id left join empleados as e on idBarber = e.id WHERE idCobro=?', id,
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

    sql.query('INSERT INTO detallescobroservicios(idCobro, idServicio, cantidad, precioActual, puntosActual, idBarber) VALUES(?,?,?,?,?,?)',
        [idCobro, idServicio, cantidad, precioActual, puntosActual, idBarber],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/detalles-producto/:id", (req, res) => {
    const id = req.params.id

    sql.query('SELECT d.id, cantidad, p.nombre, precioActual, puntosActual, e.nombre as barber FROM detallescobroproductos as d inner join productos as p on idProducto = p.id left join empleados as e on idBarber = e.id WHERE idCobro=?', id,
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

    sql.query('INSERT INTO detallescobroproductos(idCobro, idProducto, cantidad, precioActual, puntosActual, idBarber) VALUES(?,?,?,?,?,?)',
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

    sql.query('INSERT INTO reportes(idBarber, montoEfectivo, montoElectronico, montoPts, municipio) VALUES(?,?,?,?,?)',
        [idBarber, montoEfectivo, montoElectronico, montoPts, municipio],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});

app.get("/reporte-hoy/:municipio", (req, res) => {
    const municipio = req.params.municipio

    sql.query("SELECT id FROM reportes WHERE DATE(fecha) = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) AND municipio = " + municipio,
        (err, result) => {
            err ? console.log(err) : res.send(result[0]);
        }
    );
})

//Horarios
app.get("/horarios", (req, res) => {
    sql.query('SELECT * FROM horarios',
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})
app.get("/horario/:id", (req, res) => {
    const id = req.params.id
    sql.query('SELECT * FROM horarios WHERE idBarber = ?', id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.post("/create-horario", (req, res) => {
    const idBarber = req.body.idBarber
    sql.query('INSERT INTO horarios(idBarber) VALUES(?)',
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

    sql.query('UPDATE horarios SET lunIn=?, lunOut=?, marIn=?, marOut=?, mieIn=?,mieOut=?,jueIn=?,jueOut=?,vieIn=?,vieOut=?,sabIn=?,sabOut=?,domIn=?,domOut=? WHERE idBarber = ?',
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
    sql.query(query, (err, result) => {
        err ? console.log(err) : res.send(result);
    }
    );
})

app.get("/chequeos-hoy", (req, res) => {
    const query = 'SELECT dia, entrada, comidaInicio, comidaFin, salida, empleados.nombre from chequeos '
        + "inner join empleados on idBarber = empleados.id WHERE DATE(dia) = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) order by dia desc"
    sql.query(query, (err, result) => {
        err ? console.log(err) : res.send(result);
    }
    );
});

app.get("/chequeo/:id", (req, res) => {
    const id = req.params.id
    sql.query("SELECT * FROM chequeos WHERE dia = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) AND idBarber = ?", id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.get("/descanso/:id", (req, res) => {
    const id = req.params.id
    sql.query("SELECT comidaInicio, comidaFin from chequeos WHERE dia = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) AND idBarber = ?", id,
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
})

app.post("/create-chequeos", (req, res) => {
    const idBarber = req.body.idBarber
    const municipio = req.body.municipio

    sql.query('INSERT INTO chequeos(idBarber, municipio) VALUES(?,?)',
        [idBarber, municipio],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});
app.put("/iniciar-descanso", (req, res) => {
    const idBarber = req.body.idBarber

    sql.query("UPDATE chequeos SET comidaInicio = TIME(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00'))  WHERE idBarber = ? AND dia = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00'))",
        [idBarber],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});
app.put("/finalizar-descanso", (req, res) => {
    const idBarber = req.body.idBarber

    sql.query("UPDATE chequeos SET comidaFin = TIME(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) WHERE idBarber = ? AND dia = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00'))",
        [idBarber],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});
app.put("/registrar-salida", (req, res) => {
    const idBarber = req.body.idBarber

    sql.query("UPDATE chequeos SET salida = TIME(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00')) WHERE idBarber = ? AND dia = DATE(CONVERT_TZ(utc_timestamp(), '+00:00', '-06:00'))",
        [idBarber],
        (err, result) => {
            err ? console.log(err) : res.send(result);
        }
    );
});


app.listen(port, () => {
    console.log("Corriendo en el puerto " + port)
})