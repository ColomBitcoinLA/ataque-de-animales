const express = require("express");
const cors = require("cors");
const app = express();
const jugadores = []

app.use(express.json())
app.use(cors())

class Jugador {
    constructor(id) {
        this.id = id
    }

    asignarMascota(mascota) {
        this.mascota = mascota
    }

    actualizarPosicion(x, y) {
        this.x = x
        this.y = y
    }
}

class Mascota {
    constructor(nombre) {
        this.nombre = nombre
    }
}

app.use(express.static("public"))

app.get("/unirse", (req, res) => {

    const id = `${Math.random()}`
    const jugador = new Jugador(id)
    jugadores.push(jugador)

    res.setHeader("Access-Control-Allow-Origin", "*")
    res.send(id)
})

app.post("/animalCombat/:jugadorId", (req, res) => {

    const jugadorId = req.params.jugadorId || ""
    const nombreAnimal = req.body.animal || ""

    const mascota = new Mascota(nombreAnimal)
    const jugadorIndex = jugadores.findIndex(j => j.id === jugadorId)

    if (jugadorIndex >= 0) {
        jugadores[jugadorIndex].asignarMascota(mascota)
    }

    console.log(jugadores)
    res.end()
})

app.post("/animalCombat/posicion/:jugadorId", (req, res) => {
    const jugadorId = req.params.jugadorId;
    const { x, y } = req.body;
    const jugadorIndex = jugadores.findIndex(j => j.id === jugadorId);
    if (jugadorIndex >= 0) {
        jugadores[jugadorIndex].actualizarPosicion(x, y);
    }

    res.end();
})

app.listen(8080, () => {
    console.log('Servidor corriendo en el puerto 8080')
})