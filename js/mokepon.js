let ataqueJugador
let ataqueEnemigo

function iniciarJuego() { //funcion para iniciar el juego  

    let botonMascotaJugador = document.getElementById("botonMascota") //variable para seleccionar el boton de seleccionar mascota del jugador
    botonMascotaJugador.addEventListener("click", seleccionarMascotaJugador) //evento click para seleccionar mascota del jugador

    let botonFuego = document.getElementById("botonFuego") //variable para seleccionar el boton de fuego
    botonFuego.addEventListener("click", ataqueFuego) //evento click para seleccionar ataque de fuego

    let botonAgua = document.getElementById("botonAgua") //variable para seleccionar el boton de agua
    botonAgua.addEventListener("click", ataqueAgua) //evento click para seleccionar ataque de agua

    let botonTierra = document.getElementById("botonTierra") //variable para seleccionar el boton de tierra
    botonTierra.addEventListener("click", ataqueTierra) //evento click para seleccionar ataque de tierra

}
iniciarJuego(); //llamada a la funcion para iniciar el juego

function seleccionarMascotaJugador() { //funcion para seleccionar mascota del jugador

    let inputAcuaman = document.getElementById("acuaman") //variable para seleccionar el input de acuaman
    let inputCapitanPlaneta = document.getElementById("capitanPlaneta") //variable para seleccionar el input de capitanPlaneta
    let inputCharmander = document.getElementById("charmander") //variable para seleccionar el input de charmander

    let spanMascotaJugador = document.getElementById("mascota-jugador") //variable para seleccionar el span de mascota del jugador

    if (inputAcuaman.checked) { //condicional para seleccionar acuaman
        spanMascotaJugador.innerHTML = "Acuaman" //cambiar el contenido del span de mascota del jugador por acuaman;
        alert("Has seleccionado a acuaman");
    } else if (inputCapitanPlaneta.checked) { //condicional para seleccionar capitanPlaneta
        spanMascotaJugador.innerHTML = "Capitan Planeta" //cambiar el contenido del span de mascota del jugador por capitanPlaneta;
    } else if (inputCharmander.checked) { //condicional para seleccionar charmander
        spanMascotaJugador.innerHTML = "Charmander" //cambiar el contenido del span de mascota del jugador por charmander;
    } else { //condicional para seleccionar una mascota
        alert("Selecciona una mascota");
    }

    seleccionarMascotaEnemigo(); //llamada a la funcion para seleccionar mascota del enemigo
}

function seleccionarMascotaEnemigo() { //funcion para seleccionar mascota del enemigo

    let mascotaAleatoria = aleatorio(1, 3) //variable para generar un numero aleatorio entre 1 y 3
    let spanMascotaEnemigo = document.getElementById("mascota-enemigo") //variable para seleccionar el span de mascota del enemigo

    if (mascotaAleatoria === 1) {
        spanMascotaEnemigo.innerHTML = "Acuaman"
    } else if (mascotaAleatoria === 2) {
        spanMascotaEnemigo.innerHTML = "Capitan Planeta"
    } else {
        spanMascotaEnemigo.innerHTML = "Charmander"
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

    crearMensaje("Tu mascota atacó con " + ataqueJugador + " y la mascota del enemigo atacó con " + ataqueEnemigo) //llamada a la funcion para crear mensaje del resultado del combate
    revisarCombate(); //llamada a la funcion para revisar el resultado del combate
}

function crearMensaje(resultado) { //funcion para crear mensaje del resultado del combate

    let sectionMensajes = document.getElementById("mensajes") //variable para seleccionar la seccion de mensajes
    let parrafo = document.createElement("p") //variable para crear un parrafo

    parrafo.innerHTML = resultado
    sectionMensajes.appendChild(parrafo)
}

function aleatorio(min, max) { //funcion para generar un numero aleatorio entre un rango
    return Math.floor(Math.random() * (max - min + 1) + min);
}

let botonMascotaJugador = document.getElementById("botonMascota") //botón para seleccionar mascota del jugador
botonMascotaJugador.addEventListener("click", seleccionarMascotaJugador) //evento click para seleccionar mascota del jugador