const sectionReiniciar = document.getElementById("reiniciar")
const sectionSeleccionarMascota = document.getElementById("seleccionar-mascota")
const sectionSeleccionarAtaque = document.getElementById("seleccionar-ataque")

const botonMascotaJugador = document.getElementById("botonMascota")
const botonFuego = document.getElementById("botonFuego")
const botonAgua = document.getElementById("botonAgua")
const botonTierra = document.getElementById("botonTierra") 
const botonReiniciar = document.getElementById("botonReiniciar")

const inputneptuno = document.getElementById("neptuno") 
const inputtierrudo = document.getElementById("tierrudo") 
const inputsalamander = document.getElementById("salamander") 

const spanMascotaJugador = document.getElementById("mascota-jugador")
const spanMascotaEnemigo = document.getElementById("mascota-enemigo")
const spanVidasJugador = document.getElementById("vidas-jugador") 
const spanVidasEnemigo = document.getElementById("vidas-enemigo") 

const sectionMensajes = document.getElementById("resultado") 
const ataqueDelJugador = document.getElementById("ataqueDelJugador") 
const ataqueDelEnemigo = document.getElementById("ataqueDelEnemigo")

let animales = []
let ataqueJugador
let ataqueEnemigo
let vidasJugador = 3
let vidasEnemigo = 3

class Animal { 
    constructor(nombre, foto, vida) {
        this.nombre = nombre
        this.foto = foto
        this.vida = vida
        this.ataques = []
    }
}

let neptuno = new Animal("Neptuno", "./assets/agua.webp", 3)
let tierrudo = new Animal("Tierrudo", "./assets/tierra.webp", 3)
let salamander = new Animal("Salamander", "./assets/fuego.webp", 3)

animales.push(neptuno, tierrudo, salamander)

neptuno.ataques.push(
    {nombre: "💧", id: "botonAgua"},
    {nombre: "💧", id: "botonAgua"},
    {nombre: "💧", id: "botonAgua"},
    {nombre: "🌱", id: "botonTierra"},
    {nombre: "🔥", id: "botonFuego"},
)
tierrudo.ataques.push(
    {nombre: "🌱", id: "botonTierra"},
    {nombre: "🌱", id: "botonTierra"},
    {nombre: "🌱", id: "botonTierra"},
    {nombre: "💧", id: "botonAgua"},
    {nombre: "🔥", id: "botonFuego"}, 
)
salamander.ataques.push(
    {nombre: "🔥", id: "botonFuego"},
    {nombre: "🔥", id: "botonFuego"},
    {nombre: "🔥", id: "botonFuego"},
    {nombre: "🌱", id: "botonTierra"},
    {nombre: "💧", id: "botonAgua"},
)

function iniciarJuego() { 

    sectionSeleccionarAtaque.style.display = "none" 
    sectionReiniciar.style.display = "none" 

    botonMascotaJugador.addEventListener("click", seleccionarMascotaJugador) 
    botonFuego.addEventListener("click", ataqueFuego) 
    botonAgua.addEventListener("click", ataqueAgua) 
    botonTierra.addEventListener("click", ataqueTierra) 
    botonReiniciar.addEventListener("click", reiniciarJuego) 
}
iniciarJuego(); 

function seleccionarMascotaJugador() { 

    sectionSeleccionarMascota.style.display = "none" 
    sectionSeleccionarAtaque.style.display = "flex" 

    if (inputneptuno.checked) { 
        spanMascotaJugador.innerHTML = "Neptuno" 
        alert("Has seleccionado a Neptuno");
    } else if (inputtierrudo.checked) { 
        spanMascotaJugador.innerHTML = "Tierrudo" 
        alert("Has seleccionado a Tierrudo");
    } else if (inputsalamander.checked) { 
        spanMascotaJugador.innerHTML = "Salamander" 
        alert("Has seleccionado a Salamander");
    } else { 
        alert("Selecciona una mascota");
    }
    seleccionarMascotaEnemigo(); 
}

function seleccionarMascotaEnemigo() { 

    let mascotaAleatoria = aleatorio(1, 3) 
     
    if (mascotaAleatoria === 1) {
        spanMascotaEnemigo.innerHTML = "Neptuno"

    } else if (mascotaAleatoria === 2) {
        spanMascotaEnemigo.innerHTML = "Tierrudo"

    } else {
        spanMascotaEnemigo.innerHTML = "Salamander"
    }
}

function ataqueFuego() { 
    ataqueJugador = "FUEGO"
    ataqueAleatorioEnemigo();
}

function ataqueAgua() { 
    ataqueJugador = "AGUA"
    ataqueAleatorioEnemigo();
}

function ataqueTierra() { 
    ataqueJugador = "TIERRA"
    ataqueAleatorioEnemigo();
}

function ataqueAleatorioEnemigo() { 

    let ataqueAleatorio = aleatorio(1, 3);

    if (ataqueAleatorio === 1) {
        ataqueEnemigo = "FUEGO"

    } else if (ataqueAleatorio === 2) {
        ataqueEnemigo = "AGUA"

    } else {
        ataqueEnemigo = "TIERRA"
    }
    crearMensaje("Tu mascota atacó con " + ataqueJugador + " y la mascota del enemigo atacó con " + ataqueEnemigo + " - " + resultado()) 

    combate(); 
}

function combate() { 

    if ( ataqueEnemigo === ataqueJugador ) {

    } else if (ataqueJugador === "FUEGO" && ataqueEnemigo === "TIERRA") {
        vidasEnemigo--
        spanVidasEnemigo.innerHTML = vidasEnemigo

    } else if (ataqueJugador === "AGUA" && ataqueEnemigo === "FUEGO") {
        vidasEnemigo--
        spanVidasEnemigo.innerHTML = vidasEnemigo

    } else if (ataqueJugador === "TIERRA" && ataqueEnemigo === "AGUA") {
        vidasEnemigo--
        spanVidasEnemigo.innerHTML = vidasEnemigo

    } else {
        vidasJugador--
        spanVidasJugador.innerHTML = vidasJugador
    }
    revisarVidas();
}

function resultado() { 

    if ( ataqueEnemigo === ataqueJugador ) {
        return "Empate"

    } else if (ataqueJugador === "FUEGO" && ataqueEnemigo === "TIERRA") {
        return "Ganaste"

    } else if (ataqueJugador === "AGUA" && ataqueEnemigo === "FUEGO") {
        return "Ganaste"

    } else if (ataqueJugador === "TIERRA" && ataqueEnemigo === "AGUA") {
        return "Ganaste"

    } else {
        return "Perdiste"
    }
}

function revisarVidas() { 
    if (vidasEnemigo === 0) {
        crearMensajeFinal("FELICIDADES! Ganaste el juego")
    } else if (vidasJugador === 0) {
        crearMensajeFinal("Lo siento, perdiste el juego")
    }
}

function crearMensaje(resultado) { 

    let nuevoAtaqueJugador = document.createElement("p") 
    let nuevoAtaqueEnemigo = document.createElement("p") 
    
    sectionMensajes.innerHTML = resultado
    nuevoAtaqueJugador.innerHTML = ataqueJugador
    nuevoAtaqueEnemigo.innerHTML = ataqueEnemigo

    ataqueDelJugador.appendChild(nuevoAtaqueJugador)
    ataqueDelEnemigo.appendChild(nuevoAtaqueEnemigo)
}

function crearMensajeFinal(resultadoFinal) { 
     
    sectionMensajes.innerHTML = resultadoFinal

    botonFuego.disabled = true
    botonAgua.disabled = true
    botonTierra.disabled = true

    sectionReiniciar.style.display = "block"
}

function reiniciarJuego() { 
    location.reload()
}

function aleatorio(min, max) { 
    return Math.floor(Math.random() * (max - min + 1) + min);
}