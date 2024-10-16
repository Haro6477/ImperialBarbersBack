const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const multer = require('multer')
const path = require('path')
const fs = require('fs');
const sharp = require('sharp');
const postgres = require('postgres');

//#region Crear una instancia de express
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

//#region Aquí puedes usar el paquete cors con las opciones que creaste
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dbimages')))
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');


//#region Conexión db
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

//#region Home
app.get('/', (req, res) => {
    const { pass, ...rest } = sql.options;
    res.send(`¡Bienvenido Barber!\n\nDatos de la conexión:\n${JSON.stringify(rest)}`);
});


app.get('/animation', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'animation.html'));
});

//#region Función para autenticación
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

//#region Funciones para los clientes
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
        const clientes = await sql`SELECT clientes.id, nombre, telefono, pts, fechaNacimiento, clientes.municipio, MAX(fecha) AS fecha
            FROM clientes
            INNER JOIN cobros ON idCliente = clientes.id
            GROUP BY clientes.id, nombre, telefono, pts, fechaNacimiento, clientes.municipio
            ORDER BY MAX(fecha) DESC
            LIMIT 50;`;

        const totalClientes = await sql`SELECT COUNT(*) AS total FROM clientes`;

        res.send({
            clientes,
            totalClientes: totalClientes[0].total
        });
    } catch (error) {
        console.error('Error executing query', error.stack);
        res.status(500).send('Error al obtener datos de clientes');
    }
});



app.get("/clientes/municipio/:municipio", async (req, res) => {
    const municipio = req.params.municipio;

    try {
        const result = await sql`SELECT * FROM clientes where municipio = ${municipio} order by nombre`;
        res.send(result);
    } catch (error) {
        console.error('Error executing query', error.stack);
        res.status(500).send('Error interno del servidor');
    }
});

app.get("/clientes/search", async (req, res) => {
    const text = `%${req.query.text}%`;

    try {
        const result = await sql`SELECT * FROM clientes WHERE nombre ILIKE ${text} OR telefono ILIKE ${text} ORDER BY nombre LIMIT 20`;
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
    const codigoQR = req.body.codigoQR || null;
    const municipio = req.body.municipio;

    try {
        const result = await sql`
            INSERT INTO clientes (nombre, telefono, pts, genero, fechaNacimiento, codigoQR, municipio)
            VALUES (${nombre}, ${telefono}, ${pts}, ${genero}, ${fechaNacimiento}, ${codigoQR}, ${municipio})
            RETURNING *
        `;
        res.send(result[0]);
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
    const codigoQR = req.body.codigoQR || null;
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

//#region Funciones para los empleados
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


app.get("/empleados/municipio/:municipio", async (req, res) => {
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


//#region Funciones para los servicios
app.get("/servicios/municipio/:municipio", async (req, res) => {
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

app.get("/servicios/search/municipio/:municipio", async (req, res) => {
    const municipio = req.params.municipio;
    const text = `%${req.query.text}%`;

    try {
        const result = await sql`
            SELECT * FROM servicios 
            WHERE municipio = ${municipio} 
              AND nombre ILIKE ${text}
            ORDER BY nombre 
            LIMIT 7
        `;
        res.send(result);
    } catch (error) {
        console.error('Error executing query', error.stack);
        res.status(500).send('Error interno del servidor');
    }
});

app.get("/productos/search/municipio/:municipio", async (req, res) => {
    const municipio = req.params.municipio;
    const text = `%${req.query.text}%`;

    try {
        const result = await sql`
            SELECT * FROM productos 
            WHERE municipio = ${municipio} 
              AND (nombre || ' ' || marca || ' ' || linea || ' ' || contenido) ILIKE ${text}
            ORDER BY nombre 
            LIMIT 7
        `;
        res.send(result);
    } catch (error) {
        console.error('Error executing query', error.stack);
        res.status(500).send('Error interno del servidor');
    }
});


//#region Funciones para los productos
app.get("/productos/municipio/:municipio", async (req, res) => {
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

app.get("/permisos", async (req, res) => {
    try {
        const result = await sql`
            SELECT * FROM permisos order by permiso`;
        res.send(result);
    } catch (err) {
        console.error('Error al obtener los permisos', err.stack);
        res.status(500).send("Error al obtener los permisos");
    }
})

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



//#region Funciones para los cobros o ventas
app.get("/cobros/municipio/:municipio", async (req, res) => {
    const municipio = req.params.municipio;

    try {
        const result = await sql`
            SELECT v.id, c.nombre AS cliente, total, descuento, subtotal, totalPuntos, metodoPago, b.nombre AS barber, s.nombre AS cobrador, fecha, pagoEfectivo, pagoTarjeta, pagoPuntos, v.municipio
            FROM cobros AS v
            INNER JOIN clientes AS c ON v.idCliente = c.id
            INNER JOIN empleados AS b ON v.idBarber = b.id
            INNER JOIN empleados AS s ON v.idCobrador = s.id
            WHERE v.municipio = ${municipio}
            ORDER BY fecha DESC
            LIMIT 200
        `;
        res.send(result);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener los cobros");
    }
});


app.get("/cobros-hoy/municipio/:municipio", async (req, res) => {
    const municipio = req.params.municipio;

    try {
        const result = await sql`
            SELECT v.id, c.nombre AS cliente, total, descuento, subtotal, totalPuntos, metodoPago, b.nombre AS barber, s.nombre AS cobrador, fecha, pagoEfectivo, pagoTarjeta, pagoPuntos, v.municipio
            FROM cobros AS v
            INNER JOIN clientes AS c ON v.idCliente = c.id
            INNER JOIN empleados AS b ON v.idBarber = b.id
            INNER JOIN empleados AS s ON v.idCobrador = s.id
            WHERE DATE(v.fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City') = CURRENT_DATE AND v.municipio = ${municipio}
            ORDER BY fecha DESC
        `;
        res.send(result);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener los cobros de hoy");
    }
});


app.get("/cobro/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const result = await sql`
            SELECT v.id, c.nombre AS cliente, total, descuento, subtotal, totalPuntos, metodoPago, b.nombre AS barber, s.nombre AS cobrador, fecha, pagoEfectivo, pagoTarjeta, pagoPuntos
            FROM cobros AS v
            INNER JOIN clientes AS c ON v.idCliente = c.id
            INNER JOIN empleados AS b ON v.idBarber = b.id
            INNER JOIN empleados AS s ON v.idCobrador = s.id
            WHERE v.id = ${id}
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send("Error al obtener el cobro");
    }
});

app.post("/create-cobro", async (req, res) => {
    const { idCliente, total, descuento, subtotal, totalPuntos, metodoPago, idBarber, idCobrador, pagoEfectivo, pagoTarjeta, pagoPuntos, municipio } = req.body;

    try {
        const result = await sql`
            INSERT INTO cobros (idCliente, total, descuento, subtotal, totalPuntos, metodoPago, idBarber, idCobrador, pagoEfectivo, pagoTarjeta, pagoPuntos, municipio)
            VALUES (${idCliente}, ${total}, ${descuento}, ${subtotal}, ${totalPuntos}, ${metodoPago}, ${idBarber}, ${idCobrador}, ${pagoEfectivo}, ${pagoTarjeta}, ${pagoPuntos}, ${municipio})
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al crear el cobro', err.stack);
        res.status(500).send("Error al crear el cobro");
    }
});


//#region Inventario puntos y caja
app.get("/caja/municipio/:municipio", async (req, res) => {
    const municipio = req.params.municipio;

    try {
        const result = await sql`
            SELECT *
            FROM caja
            WHERE municipio = ${municipio}
        `;
        res.send(result);
    } catch (err) {
        console.error('Error al obtener la caja', err.stack);
        res.status(500).send("Error al obtener la caja");
    }
});

app.put("/update-caja", async (req, res) => {
    const { id, efectivo, dineroElectronico, puntos } = req.body;

    try {
        const result = await sql`
            UPDATE caja 
            SET efectivo = efectivo + ${efectivo}, dineroElectronico = dineroElectronico + ${dineroElectronico}, puntos = puntos + ${puntos}
            WHERE id = ${id}
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al actualizar la caja', err.stack);
        res.status(500).send("Error al actualizar la caja");
    }
});

app.put("/update-cliente-pts", async (req, res) => {
    const { id, pts } = req.body;

    try {
        const updateResult = await sql`
            UPDATE clientes 
            SET pts = pts + ${pts}
            WHERE id = ${id}
            RETURNING *
        `;
        res.send(updateResult[0]);
    } catch (err) {
        console.error('Error al actualizar puntos', err.stack);
        res.status(500).send("Error al actualizar puntos");
    }
});


app.put("/update-inventario", async (req, res) => {
    const { id, cantidad } = req.body;

    try {
        const result = await sql`
            UPDATE productos 
            SET enVenta = enVenta + ${cantidad}
            WHERE id = ${id}
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al actualizar inventario', err.stack);
        res.status(500).send("Error al actualizar inventario");
    }
});


app.post("/create-movimiento", async (req, res) => {
    const { concepto, cantidad, idUsuario, municipio } = req.body;

    try {
        const result = await sql`
            INSERT INTO movimientos (concepto, cantidad, idUsuario, municipio)
            VALUES (${concepto}, ${cantidad}, ${idUsuario}, ${municipio})
            RETURNING id
        `;
        const newMovimientoId = result[0].id;

        const selectResult = await sql`
            SELECT m.id, concepto, cantidad, fechaHora, nombre, m.municipio 
            FROM movimientos AS m 
            INNER JOIN empleados ON idUsuario = empleados.id 
            WHERE m.id = ${newMovimientoId}
        `;
        res.send(selectResult[0]);
    } catch (err) {
        console.error('Error al insertar movimiento', err.stack);
        res.status(500).send("Error al insertar movimiento");
    }
});


app.get("/movimientos/municipio/:municipio", async (req, res) => {
    const municipio = req.params.municipio;

    try {
        const result = await sql`
            SELECT m.id, concepto, cantidad, fechaHora, nombre, m.municipio 
            FROM movimientos AS m 
            INNER JOIN empleados ON idUsuario = empleados.id 
            WHERE DATE(v.fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City') != CURRENT_DATE AND m.municipio = ${municipio}
        `;
        res.send(result);
    } catch (err) {
        console.error('Error al obtener movimientos', err.stack);
        res.status(500).send("Error al obtener movimientos");
    }
});

app.get("/movimientos-hoy/municipio/:municipio", async (req, res) => {
    const municipio = req.params.municipio;

    try {
        const result = await sql`
            SELECT m.id, concepto, cantidad, fechaHora, nombre, m.municipio 
            FROM movimientos AS m 
            INNER JOIN empleados ON idUsuario = empleados.id 
            WHERE DATE(m.fechaHora) = CURRENT_DATE AND m.municipio = ${municipio}
        `;
        res.send(result);
    } catch (err) {
        console.error('Error al obtener movimientos de hoy', err.stack);
        res.status(500).send("Error al obtener movimientos de hoy");
    }
});



//#region Detalles de cobro de servicios y productos
app.get("/detalles-servicio/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const result = await sql`
            SELECT d.id, cantidad, s.nombre, precioActual, puntosActual, e.nombre AS barber
            FROM detallescobroservicios AS d
            INNER JOIN servicios AS s ON d.idServicio = s.id
            LEFT JOIN empleados AS e ON d.idBarber = e.id
            WHERE d.idCobro = ${id}
        `;
        res.send(result);
    } catch (err) {
        console.error('Error al obtener detalles del servicio', err.stack);
        res.status(500).send("Error al obtener detalles del servicio");
    }
});


app.post("/create-detalle-servicio", async (req, res) => {
    console.log(req.body);  // Para revisar qué datos llegan al backend
    const { idCobro, idServicio, cantidad, precioActual, puntosActual, idBarber } = req.body;

    try {
        const result = await sql`
            INSERT INTO detallescobroservicios (idCobro, idServicio, cantidad, precioActual, puntosActual, idBarber)
            VALUES (${idCobro}, ${idServicio}, ${cantidad}, ${precioActual}, ${puntosActual}, ${idBarber})
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al crear detalle del servicio', err.stack);
        res.status(500).send("Error al crear detalle del servicio");
    }
});



app.get("/detalles-producto/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const result = await sql`
            SELECT d.id, cantidad, p.nombre, precioActual, puntosActual, e.nombre AS barber
            FROM detallescobroproductos AS d
            INNER JOIN productos AS p ON d.idProducto = p.id
            LEFT JOIN empleados AS e ON d.idBarber = e.id
            WHERE d.idCobro = ${id}
        `;
        res.send(result);
    } catch (err) {
        console.error('Error al obtener detalles del producto', err.stack);
        res.status(500).send("Error al obtener detalles del producto");
    }
});

app.post("/create-detalle-producto", async (req, res) => {
    const { idCobro, idProducto, cantidad, precioActual, puntosActual, idBarber } = req.body;

    try {
        const result = await sql`
            INSERT INTO detallescobroproductos (idCobro, idProducto, cantidad, precioActual, puntosActual, idBarber)
            VALUES (${idCobro}, ${idProducto}, ${cantidad}, ${precioActual}, ${puntosActual}, ${idBarber})
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al crear detalle del producto', err.stack);
        res.status(500).send("Error al crear detalle del producto");
    }
});



//#region Reportes
app.post("/create-reporte", async (req, res) => {
    const { idBarber, montoEfectivo, montoElectronico, montoPts, municipio } = req.body;

    try {
        const result = await sql`
            INSERT INTO reportes (idBarber, montoEfectivo, montoElectronico, montoPts, municipio)
            VALUES (${idBarber}, ${montoEfectivo}, ${montoElectronico}, ${montoPts}, ${municipio})
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al crear el reporte', err.stack);
        res.status(500).send("Error al crear el reporte");
    }
});

app.get("/reporte-hoy/municipio/:municipio", async (req, res) => {
    const municipio = req.params.municipio;

    try {
        const result = await sql`
            SELECT id 
            FROM reportes 
            WHERE DATE(fecha) = CURRENT_DATE AND municipio = ${municipio}
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al obtener el reporte de hoy', err.stack);
        res.status(500).send("Error al obtener el reporte de hoy");
    }
});


//#region Horarios
app.get("/horarios", async (req, res) => {
    try {
        const result = await sql`
            SELECT * 
            FROM horarios
        `;
        res.send(result);
    } catch (err) {
        console.error('Error al obtener horarios', err.stack);
        res.status(500).send("Error al obtener horarios");
    }
});

app.post("/create-horario", async (req, res) => {
    const { idBarber } = req.body;

    try {
        const result = await sql`
            INSERT INTO horarios (idBarber)
            VALUES (${idBarber})
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al crear horario', err.stack);
        res.status(500).send("Error al crear horario");
    }
});


app.put("/update-horario", async (req, res) => {
    const { idBarber, lunIn, lunOut, marIn, marOut, mieIn, mieOut, jueIn, jueOut, vieIn, vieOut, sabIn, sabOut, domIn, domOut } = req.body;

    try {
        const result = await sql`
            UPDATE horarios
            SET lunIn = ${lunIn}, lunOut = ${lunOut}, marIn = ${marIn}, marOut = ${marOut}, 
                mieIn = ${mieIn}, mieOut = ${mieOut}, jueIn = ${jueIn}, jueOut = ${jueOut}, 
                vieIn = ${vieIn}, vieOut = ${vieOut}, sabIn = ${sabIn}, sabOut = ${sabOut}, 
                domIn = ${domIn}, domOut = ${domOut}
            WHERE idBarber = ${idBarber}
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al actualizar el horario', err.stack);
        res.status(500).send("Error al actualizar el horario");
    }
});


//#region Chequeos
app.get("/chequeos", async (req, res) => {
    try {
        const result = await sql`
            SELECT dia, entrada, comidaInicio, comidaFin, salida, empleados.nombre
            FROM chequeos
            INNER JOIN empleados ON idBarber = empleados.id
            ORDER BY dia DESC
            LIMIT 50
        `;
        res.send(result);
    } catch (err) {
        console.error('Error al obtener chequeos', err.stack);
        res.status(500).send("Error al obtener chequeos");
    }
});

app.get("/chequeos-hoy", async (req, res) => {
    try {
        const result = await sql`
            SELECT dia, entrada, comidaInicio, comidaFin, salida, empleados.nombre
            FROM chequeos
            INNER JOIN empleados ON idBarber = empleados.id
            WHERE DATE(dia) = CURRENT_DATE
            ORDER BY dia DESC
        `;
        res.send(result);
    } catch (err) {
        console.error('Error al obtener chequeos de hoy', err.stack);
        res.status(500).send("Error al obtener chequeos de hoy");
    }
});

app.get("/chequeo/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const result = await sql`
            SELECT * 
            FROM chequeos 
            WHERE DATE(dia) = CURRENT_DATE AND idBarber = ${id}
        `;
        res.send(result);
    } catch (err) {
        console.error('Error al obtener chequeo', err.stack);
        res.status(500).send("Error al obtener chequeo");
    }
});

app.get("/descanso/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const result = await sql`
            SELECT comidaInicio, comidaFin 
            FROM chequeos 
            WHERE DATE(dia) = CURRENT_DATE AND idBarber = ${id}
        `;
        res.send(result);
    } catch (err) {
        console.error('Error al obtener descanso', err.stack);
        res.status(500).send("Error al obtener descanso");
    }
});

app.post("/create-chequeos", async (req, res) => {
    const { idBarber, municipio } = req.body;

    try {
        const result = await sql`
            INSERT INTO chequeos (idBarber, municipio)
            VALUES (${idBarber}, ${municipio})
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al crear chequeo', err.stack);
        res.status(500).send("Error al crear chequeo");
    }
});

app.put("/iniciar-descanso", async (req, res) => {
    const { idBarber } = req.body;

    try {
        const result = await sql`
            UPDATE chequeos
            SET comidaInicio = CURRENT_TIME
            WHERE idBarber = ${idBarber} AND DATE(dia) = CURRENT_DATE
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al iniciar descanso', err.stack);
        res.status(500).send("Error al iniciar descanso");
    }
});

app.put("/finalizar-descanso", async (req, res) => {
    const { idBarber } = req.body;

    try {
        const result = await sql`
            UPDATE chequeos
            SET comidaFin = CURRENT_TIME
            WHERE idBarber = ${idBarber} AND DATE(dia) = CURRENT_DATE
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al finalizar descanso', err.stack);
        res.status(500).send("Error al finalizar descanso");
    }
});

app.put("/registrar-salida", async (req, res) => {
    const { idBarber } = req.body;

    try {
        const result = await sql`
            UPDATE chequeos
            SET salida = CURRENT_TIME
            WHERE idBarber = ${idBarber} AND DATE(dia) = CURRENT_DATE
            RETURNING *
        `;
        res.send(result[0]);
    } catch (err) {
        console.error('Error al registrar salida', err.stack);
        res.status(500).send("Error al registrar salida");
    }
});

//#region Final ListenPort
app.listen(port, () => {
    console.log("Corriendo en el puerto " + port)
})