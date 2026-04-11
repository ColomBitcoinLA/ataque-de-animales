let ataqueJugador
let ataqueEnemigo
let vidasJugador = 3
let vidasEnemigo = 3

function iniciarJuego() { //funcion para iniciar el juego  

    let sectionSeleccionarAtaque = document.getElementById("seleccionar-ataque") //variable para seleccionar la seccion de seleccionar ataque
    sectionSeleccionarAtaque.style.display = "none" //ocultar la seccion de seleccionar ataque

    let sectionReiniciar = document.getElementById("reiniciar") //variable para seleccionar la seccion de reiniciar
    sectionReiniciar.style.display = "none" //ocultar la seccion de reiniciar

    let botonMascotaJugador = document.getElementById("botonMascota") //variable para seleccionar el boton de seleccionar mascota del jugador
    botonMascotaJugador.addEventListener("click", seleccionarMascotaJugador) //evento click para seleccionar mascota del jugador

    let botonFuego = document.getElementById("botonFuego") //variable para seleccionar el boton de fuego
    botonFuego.addEventListener("click", ataqueFuego) //evento click para seleccionar ataque de fuego

    let botonAgua = document.getElementById("botonAgua") //variable para seleccionar el boton de agua
    botonAgua.addEventListener("click", ataqueAgua) //evento click para seleccionar ataque de agua

    let botonTierra = document.getElementById("botonTierra") //variable para seleccionar el boton de tierra
    botonTierra.addEventListener("click", ataqueTierra) //evento click para seleccionar ataque de tierra

    let botonReiniciar = document.getElementById("botonReiniciar") //variable para seleccionar el boton de reiniciar
    botonReiniciar.addEventListener("click", reiniciarJuego) //evento click para reiniciar el juego
}
iniciarJuego(); //llamada a la funcion para iniciar el juego

function seleccionarMascotaJugador() { //funcion para seleccionar mascota del jugador

    let sectionSeleccionarMascota = document.getElementById("seleccionar-mascota") //variable para seleccionar la seccion de seleccionar mascota
    sectionSeleccionarMascota.style.display = "none" //ocultar la seccion de seleccionar mascota

    let sectionSeleccionarAtaque = document.getElementById("seleccionar-ataque") 
    sectionSeleccionarAtaque.style.display = "flex" //mostrar la seccion de seleccionar ataque

    let inputAcuaman = document.getElementById("acuaman") //variable para seleccionar el input de acuaman
    let inputCapitanPlaneta = document.getElementById("capitanPlaneta") //variable para seleccionar el input de capitanPlaneta
    let inputCharmander = document.getElementById("charmander") //variable para seleccionar el input de charmander
    let spanMascotaJugador = document.getElementById("mascota-jugador") //variable para seleccionar el span de mascota del jugador

    if (inputAcuaman.checked) { //condicional para seleccionar acuaman
        spanMascotaJugador.innerHTML = "Neptuno" //cambiar el contenido del span de mascota del jugador por acuaman;
        alert("Has seleccionado a Neptuno");

    } else if (inputCapitanPlaneta.checked) { //condicional para seleccionar capitanPlaneta
        spanMascotaJugador.innerHTML = "Tierrudo" //cambiar el contenido del span de mascota del jugador por capitanPlaneta;
        alert("Has seleccionado a Tierrudo");

    } else if (inputCharmander.checked) { //condicional para seleccionar charmander
        spanMascotaJugador.innerHTML = "Salamander" //cambiar el contenido del span de mascota del jugador por charmander;
        alert("Has seleccionado a Salamander");

    } else { //condicional para seleccionar una mascota
        alert("Selecciona una mascota");
    }

    seleccionarMascotaEnemigo(); //llamada a la funcion para seleccionar mascota del enemigo
}

function seleccionarMascotaEnemigo() { //funcion para seleccionar mascota del enemigo

    let mascotaAleatoria = aleatorio(1, 3) //variable para generar un numero aleatorio entre 1 y 3
    let spanMascotaEnemigo = document.getElementById("mascota-enemigo") //variable para seleccionar el span de mascota del enemigo

    if (mascotaAleatoria === 1) {
        spanMascotaEnemigo.innerHTML = "Neptuno"

    } else if (mascotaAleatoria === 2) {
        spanMascotaEnemigo.innerHTML = "Tierrudo"

    } else {
        spanMascotaEnemigo.innerHTML = "Salamander"
    }
}

function ataqueFuego() { //funcion para seleccionar ataque de fuego
    ataqueJugador = "FUEGO"
    ataqueAleatorioEnemigo();
}

function ataqueAgua() { //funcion para seleccionar ataque de agua
    ataqueJugador = "AGUA"
    ataqueAleatorioEnemigo();
}

function ataqueTierra() { //funcion para seleccionar ataque de tierra
    ataqueJugador = "TIERRA"
    ataqueAleatorioEnemigo();
}

function ataqueAleatorioEnemigo() { //funcion para seleccionar ataque del enemigo

    let ataqueAleatorio = aleatorio(1, 3);

    if (ataqueAleatorio === 1) {
        ataqueEnemigo = "FUEGO"

    } else if (ataqueAleatorio === 2) {
        ataqueEnemigo = "AGUA"

    } else {
        ataqueEnemigo = "TIERRA"
    }

    crearMensaje("Tu mascota atacó con " + ataqueJugador + " y la mascota del enemigo atacó con " + ataqueEnemigo + " - " + resultado()) //llamada a la funcion para crear mensaje del resultado del combate

    combate(); //llamada a la funcion para revisar el resultado del combate
}

function combate() { //funcion para revisar el resultado del combate

    let spanVidasJugador = document.getElementById("vidas-jugador") //variable para seleccionar el span de vidas del jugador
    let spanVidasEnemigo = document.getElementById("vidas-enemigo") //variable para seleccionar el span de vidas del enemigo

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
    //despues del combate revisar si el jugador o el enemigo perdio todas sus vidas para mostrar el mensaje final del juego
    revisarVidas();
}

function resultado() { //funcion para revisar el resultado del combate

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

function revisarVidas() { //funcion para revisar si el jugador o el enemigo perdio todas sus vidas
    if (vidasEnemigo === 0) {
        crearMensajeFinal("FELICIDADES! Ganaste el juego")
    } else if (vidasJugador === 0) {
        crearMensajeFinal("Lo siento, perdiste el juego")
    }
}

function crearMensaje(resultado) { //funcion para crear mensaje del resultado del combate

    let sectionMensajes = document.getElementById("resultado") //variable para seleccionar la seccion de mensajes
    let ataqueDelJugador = document.getElementById("ataqueDelJugador") //variable para seleccionar la seccion de ataque del jugador
    let ataqueDelEnemigo = document.getElementById("ataqueDelEnemigo") //variable para seleccionar la seccion de ataque del enemigo

    //let notificacion = document.createElement("p") //variable para crear un parrafo
    let nuevoAtaqueJugador = document.createElement("p") //variable para crear el parrafo del ataque del jugador
    let nuevoAtaqueEnemigo = document.createElement("p") //variable para crear el parrafo del ataque del enemigo

    //let parrafo = document.createElement("p") //variable para crear un parrafo

    sectionMensajes.innerHTML = resultado
    nuevoAtaqueJugador.innerHTML = ataqueJugador
    nuevoAtaqueEnemigo.innerHTML = ataqueEnemigo

    //parrafo.innerHTML = resultado
    //sectionMensajes.appendChild(notificacion)
    ataqueDelJugador.appendChild(nuevoAtaqueJugador)
    ataqueDelEnemigo.appendChild(nuevoAtaqueEnemigo)
}

function crearMensajeFinal(resultadoFinal) { //funcion para crear mensaje del resultado del combate

    let sectionMensajes = document.getElementById("resultado") //variable para seleccionar la seccion de mensajes
    //let parrafo = document.createElement("p") //variable para crear un parrafo
    
    sectionMensajes.innerHTML = resultadoFinal
    //sectionMensajes.appendChild(parrafo)

    let botonFuego = document.getElementById("botonFuego") 
    botonFuego.disabled = true

    let botonAgua = document.getElementById("botonAgua") 
    botonAgua.disabled = true

    let botonTierra = document.getElementById("botonTierra") 
    botonTierra.disabled = true

    let sectionReiniciar = document.getElementById("reiniciar")
    sectionReiniciar.style.display = "block"
}

function reiniciarJuego() { //funcion para reiniciar el juego
    location.reload()
}

function aleatorio(min, max) { //funcion para generar un numero aleatorio entre un rango
    return Math.floor(Math.random() * (max - min + 1) + min);
}