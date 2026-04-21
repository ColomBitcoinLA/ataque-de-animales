//CONSTANTES Y SELECTORES:
const sectionReiniciar = document.getElementById("reiniciar")
const sectionSeleccionarMascota = document.getElementById("seleccionar-mascota")
const sectionSeleccionarAtaque = document.getElementById("seleccionar-ataque")
const sectionMensajes = document.getElementById("resultado")

const botonMascotaJugador = document.getElementById("botonMascota") 
const botonReiniciar = document.getElementById("botonReiniciar")

const spanMascotaJugador = document.getElementById("mascota-jugador")
const spanMascotaEnemigo = document.getElementById("mascota-enemigo")
const spanVidasJugador = document.getElementById("vidas-jugador") 
const spanVidasEnemigo = document.getElementById("vidas-enemigo") 

const ataqueDelJugador = document.getElementById("ataqueDelJugador") 
const ataqueDelEnemigo = document.getElementById("ataqueDelEnemigo")

const contenedorTarjetas = document.getElementById("contenedor-tarjetas")
const contenedorAtaques = document.getElementById("contenedor-ataque")

const sectionVerMapa = document.getElementById("ver-mapa")
const mapa = document.getElementById("mapa")
const botonIniciarPelea = document.getElementById("botonIniciarPelea")
const anchoMaximoDelMapa = 600

//CONFIGURACIÓN DEL JUEGO:
const TIPOS_ATAQUE = [
    { nombre: "FUEGO", emoji: "🔥", id: "botonFuego" },
    { nombre: "AGUA", emoji: "💧", id: "botonAgua" },
    { nombre: "TIERRA", emoji: "🌱", id: "botonTierra" }

]
const FUERZA_ATAQUES = {
    "FUEGO": "TIERRA",  
    "AGUA": "FUEGO",    
    "TIERRA": "AGUA"    
}

//VARIABLES GLOBALES
let animales = []
let ataqueJugador = []
let ataqueEnemigo = []
let opcionDeAnimales
let botonesAtaques = []
let nombreMascotaJugador = ""
let nombreMascotaEnemigo = ""
let mascotaJugadorObjeto
let rondasJugador = 0
let rondasEnemigo = 0
let lienzo = mapa.getContext("2d")
let intervalo
let mapaBackground = new Image()
mapaBackground.src = "./assets/mapaCombat.webp"
let colisionOcurrida = false
let alturaQueBuscamos
let anchoDelMapa = window.innerWidth - 10
let jugadorId = ""

if (anchoDelMapa > anchoMaximoDelMapa) {
    anchoDelMapa = anchoMaximoDelMapa - 10
    alturaQueBuscamos = anchoDelMapa * 700 / 800
    mapa.width = anchoDelMapa
    mapa.height = alturaQueBuscamos
}

//CLASES:
class Animal { 
    constructor(nombre, foto, vida, fotoMapa, x, y) {
        this.nombre = nombre
        this.foto = foto
        this.vida = vida
        this.ataques = []
        this.x = x
        this.y = y
        this.ancho = 300
        this.alto = 300
        this.mapaFoto = new Image()
        this.mapaFoto.src = fotoMapa
        this.velocidadX = 0
        this.velocidadY = 0
        this.anchoColision = 30; 
        this.altoColision = 30;
        this.offsetX = (this.ancho - this.anchoColision) / 2;
        this.offsetY = (this.alto - this.altoColision) / 2;
    }

    pintarAnimal() {
    
        lienzo.drawImage(
            this.mapaFoto,
            this.x,
            this.y,
            this.ancho, 
            this.alto, 
        )
    }
}

//INSTANCIAS DE ANIMALES:
let neptuno = new Animal("Neptuno", "./assets/agua.webp", 3, "./assets/cabezaNeptuno.webp")
let tierrudo = new Animal("Tierrudo", "./assets/tierra.webp", 3, "./assets/cabezaTierrudo.webp")
let salamander = new Animal("Salamander", "./assets/fuego.webp", 3, "./assets/cabezaSalamander.webp")

//Cabezas Mascota Enemigo
let neptunoEnemigo = new Animal("Neptuno", "./assets/agua.webp", 3, "./assets/cabezaNeptuno.webp", 124, 50)
let tierrudoEnemigo = new Animal("Tierrudo", "./assets/tierra.webp", 3, "./assets/cabezaTierrudo.webp", 44, 111)
let salamanderEnemigo = new Animal("Salamander", "./assets/fuego.webp", 3, "./assets/cabezaSalamander.webp", 287, 2)

neptuno.ataques = [
    {id: "botonAgua"},  // 💧
    {id: "botonAgua"},  // 💧
    {id: "botonAgua"},  // 💧
    {id: "botonTierra"}, // 🌱
    {id: "botonFuego"},   // 🔥
]
tierrudo.ataques = [
    {id: "botonTierra"}, // 🌱
    {id: "botonTierra"}, // 🌱
    {id: "botonTierra"}, // 🌱
    {id: "botonAgua"},   // 💧
    {id: "botonFuego"},   // 🔥
]
salamander.ataques = [
    {id: "botonFuego"},  // 🔥
    {id: "botonFuego"},  // 🔥
    {id: "botonFuego"},  // 🔥
    {id: "botonTierra"}, // 🌱
    {id: "botonAgua"},    // 💧
]
animales.push(neptuno, tierrudo, salamander)

//FUNCIONES AUXILIARES:
function aleatorio(min, max) { 
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function convertirAEmoji(ataque) {
    if (ataque === "FUEGO") return "🔥"
    if (ataque === "AGUA") return "💧"
    if (ataque === "TIERRA") return "🌱"
    return "❓"
}

function obtenerAtaqueAleatorio() {
    const indiceAleatorio = aleatorio(0, TIPOS_ATAQUE.length - 1)
    return TIPOS_ATAQUE[indiceAleatorio]
}

//FUNCIONES PRINCIPALES:
function iniciarJuego() { 
    sectionSeleccionarAtaque.style.display = "none"
    sectionVerMapa.style.display = "none" 
    sectionReiniciar.style.display = "none" 
    contenedorTarjetas.innerHTML = "" 
    
    animales.forEach((Animal) => {

        opcionDeAnimales = `
            <label class="tarjeta-animal">
                <p>${Animal.nombre}</p>
                <img src=${Animal.foto} alt=${Animal.nombre}/>
                <input type="radio" name="mascota" value="${Animal.nombre}" id=${Animal.nombre}/>
            </label>
        `
        contenedorTarjetas.innerHTML += opcionDeAnimales
    })
    botonMascotaJugador.addEventListener("click", seleccionarMascotaJugador) 
    botonReiniciar.addEventListener("click", reiniciarJuego)

    unirseAlJuego()
}
iniciarJuego();

function unirseAlJuego() {
    fetch("http://localhost:8080/unirse")
    .then(response => response.text())
    .then(data => {
        console.log(data)
        jugadorId = data
    })
}

function seleccionarMascotaJugador() { 

    const mascotaSeleccionada = document.querySelector('#contenedor-tarjetas input[name="mascota"]:checked')
    
    if (!mascotaSeleccionada) {
        sectionMensajes.innerHTML = "⚠️ Selecciona una mascota";
        return
    }
    
    nombreMascotaJugador = mascotaSeleccionada.value
    spanMascotaJugador.innerHTML = nombreMascotaJugador
    sectionMensajes.innerHTML = `✅ Has seleccionado a ${nombreMascotaJugador}`;

    rondasJugador = 0;
    rondasEnemigo = 0;
    spanVidasJugador.innerHTML = rondasJugador;  
    spanVidasEnemigo.innerHTML = rondasEnemigo;

    ataqueDelJugador.innerHTML = ""
    ataqueDelEnemigo.innerHTML = ""

    const mascota = animales.find(a => a.nombre === nombreMascotaJugador)
    if (mascota) {
        mostrarAtaques(mascota.ataques)
    }
    
    seleccionarMascota(nombreMascotaJugador)

    setTimeout(() => {
        sectionSeleccionarMascota.style.display = "none" 
        sectionVerMapa.style.display = "flex"
        document.body.classList.add("mapa-activo")  // Difuminar fondo
        sectionMensajes.innerHTML = "⚔️ ¡Prepárate para el combate! ⚔️"
    }, 200);

    iniciarMapa()
}

function seleccionarMascota(nombreAnimal) {

    fetch(`http://localhost:8080/animalCombat/${jugadorId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            animal: nombreAnimal
        })
    })
}

function iniciarMapa() { 

    mascotaJugadorObjeto = obtenerObjetoMascota(nombreMascotaJugador)
    mascotaJugadorObjeto.x = 550;
    mascotaJugadorObjeto.y = 450;

    botonIniciarPelea.addEventListener("click", () => {
        ocultarMapa()
        sectionSeleccionarAtaque.style.display = "flex"
        sectionMensajes.innerHTML = "⚔️ ¡Prepárate para el combate! ⚔️"
    })

    document.body.classList.add("mapa-activo")
    sectionVerMapa.style.display = "flex"

    mapaBackground.onload = function() {

        iniciarPelea()
    }
    
    if (mapaBackground.complete) {
        iniciarPelea()
    }
}

function ocultarMapa() {

    document.body.classList.remove("mapa-activo")
    sectionVerMapa.style.display = "none"
}


function iniciarPelea() {        

    intervalo = setInterval(pintarCanvas, 50)
    window.addEventListener("keydown", teclaPresionada)
    window.addEventListener("keyup", detenerMovimiento)
}

function mostrarAtaques(ataques) {
    if (!contenedorAtaques) {
        console.error("contenedorAtaques no encontrado")
        return
    } 
    contenedorAtaques.innerHTML = ""
    botonesAtaques = [] 
    
    ataques.forEach((ataqueId) => {
        
        const ataqueInfo = TIPOS_ATAQUE.find(a => a.id === ataqueId.id)
        
        if (!ataqueInfo) return
        
        const boton = document.createElement("button")
        boton.textContent = ataqueInfo.emoji
        boton.id = ataqueInfo.id
        boton.classList.add("botonAtaque")
        boton.disabled = false
        boton.style.opacity = "1"
        botonesAtaques.push(boton) 
        contenedorAtaques.appendChild(boton)
    })
    secuenciarAtaque()  
}

function secuenciarAtaque() {
    botonesAtaques.forEach((boton) => {
        const nuevoBoton = boton.cloneNode(true);
        boton.parentNode.replaceChild(nuevoBoton, boton);

        nuevoBoton.addEventListener("click", (e) => {
            const ataqueEncontrado = TIPOS_ATAQUE.find(
                a => a.emoji === e.target.textContent
            );
            if (!ataqueEncontrado) return;

            const ataqueJug = ataqueEncontrado.nombre;
            const emojiJug = ataqueEncontrado.emoji;
            ataqueJugador.push(ataqueJug);
            const nuevoAtaqueJugador = document.createElement("p");
            nuevoAtaqueJugador.innerHTML = `⚔️ Ataque ${ataqueJugador.length}: ${emojiJug}`;
            nuevoAtaqueJugador.classList.add("ataque-individual");
            ataqueDelJugador.appendChild(nuevoAtaqueJugador);

            e.target.disabled = true;
            e.target.style.opacity = "0.5";

            const ataqueObjEnem = obtenerAtaqueAleatorio();
            const ataqueEnem = ataqueObjEnem.nombre;
            const emojiEnem = ataqueObjEnem.emoji;
            ataqueEnemigo.push(ataqueEnem);
            const nuevoAtaqueEnemigo = document.createElement("p");
            nuevoAtaqueEnemigo.innerHTML = `⚔️ Ataque ${ataqueEnemigo.length}: ${emojiEnem}`;
            nuevoAtaqueEnemigo.classList.add("ataque-individual");
            ataqueDelEnemigo.appendChild(nuevoAtaqueEnemigo);

            let resultadoRonda = "";
            let emojiResultado = "";

            if (ataqueJug === ataqueEnem) {
                resultadoRonda = "Empate";
                emojiResultado = "🤝";
                
            } else if (FUERZA_ATAQUES[ataqueJug] === ataqueEnem) {
                resultadoRonda = "Ganaste";
                emojiResultado = "✅";
                rondasJugador++;
                spanVidasJugador.innerHTML = rondasJugador;  
            } else {
                resultadoRonda = "Perdiste";
                emojiResultado = "❌";
                rondasEnemigo++;
                spanVidasEnemigo.innerHTML = rondasEnemigo;  
            }

            const pRonda = document.createElement("p");
            pRonda.innerHTML = `${emojiResultado} Ronda ${ataqueJugador.length}: ${emojiJug} vs ${emojiEnem} - ${resultadoRonda}`;
            sectionMensajes.appendChild(pRonda);

            if (ataqueJugador.length === 5) {
                finalizarJuego();
            }
        });
        const index = botonesAtaques.indexOf(boton);
        if (index !== -1) botonesAtaques[index] = nuevoBoton;
    });
}

function finalizarJuego() {
    let victoriasJugador = 0;
    let victoriasEnemigo = 0;

    for (let i = 0; i < 5; i++) {
        if (ataqueJugador[i] === ataqueEnemigo[i]) continue;
        if (FUERZA_ATAQUES[ataqueJugador[i]] === ataqueEnemigo[i]) victoriasJugador++;
        else victoriasEnemigo++;
    }

    let mensajeFinal = "";
    if (rondasJugador > rondasEnemigo) {
        mensajeFinal = `🎉 GANASTE EL JUEGO! ${rondasJugador} vs ${rondasEnemigo} 🎉`;
    } else if (rondasEnemigo > rondasJugador) {
        mensajeFinal = `💀 PERDISTE EL JUEGO! ${rondasJugador} vs ${rondasEnemigo} 💀`;
    } else {
        mensajeFinal = `🤝 EMPATE TOTAL! ${rondasJugador} vs ${rondasEnemigo} 🤝`;
    }

    const pFinal = document.createElement("p");
    pFinal.innerHTML = mensajeFinal;
    pFinal.classList.add("mensaje-final");
    sectionMensajes.appendChild(pFinal);

    botonesAtaques.forEach(boton => boton.disabled = true);
    sectionReiniciar.style.display = "block";
}

function terminarTurno() {
    ataqueDelEnemigo.innerHTML = ""
    ataqueEnemigo = []
    
    for (let i = 0; i < 5; i++) {
        
        const ataqueObjeto = obtenerAtaqueAleatorio()
        const ataque = ataqueObjeto.nombre
        const emoji = ataqueObjeto.emoji
        ataqueEnemigo.push(ataque)
        const nuevoAtaqueEnemigo = document.createElement("p")
        nuevoAtaqueEnemigo.innerHTML = `⚔️ Ataque ${i+1}: ${emoji}`
        nuevoAtaqueEnemigo.classList.add("ataque-individual")
        ataqueDelEnemigo.appendChild(nuevoAtaqueEnemigo)
    }
    compararAtaques()
}

function compararAtaques() {
    let victoriasJugador = 0
    let victoriasEnemigo = 0
    
    sectionMensajes.innerHTML = ""
    const titulo = document.createElement("p")
    titulo.innerHTML = "📊 RESULTADOS DE LA BATALLA 📊"
    titulo.style.fontWeight = "bold"
    titulo.style.marginBottom = "10px"
    titulo.style.textAlign = "center"
    sectionMensajes.appendChild(titulo)
    
    for (let i = 0; i < 5; i++) {
        const ataqueJug = ataqueJugador[i]
        const ataqueEnem = ataqueEnemigo[i]
        
        let resultadoRonda = ""
        let emojiResultado = ""
        
        if (ataqueJug === ataqueEnem) {
            resultadoRonda = "Empate"
            emojiResultado = "🤝"
        } else if (FUERZA_ATAQUES[ataqueJug] === ataqueEnem) {
            resultadoRonda = "Ganaste"
            emojiResultado = "✅"
            victoriasJugador++
        } else {
            resultadoRonda = "Perdiste"
            emojiResultado = "❌"
            victoriasEnemigo++
        }
       
        const p = document.createElement("p")
        p.innerHTML = `${emojiResultado} Ronda ${i+1}: ${convertirAEmoji(ataqueJug)} vs ${convertirAEmoji(ataqueEnem)} - ${resultadoRonda}`
        sectionMensajes.appendChild(p)
    }
    
    let mensajeFinal = ""
    let emojiFinal = ""
    
    if (victoriasJugador > victoriasEnemigo) {
        mensajeFinal = `🎉 GANASTE EL JUEGO! ${victoriasJugador} vs ${victoriasEnemigo} 🎉`
        emojiFinal = "🏆"
    } else if (victoriasEnemigo > victoriasJugador) {
        mensajeFinal = `💀 PERDISTE EL JUEGO! ${victoriasJugador} vs ${victoriasEnemigo} 💀`
        emojiFinal = "💀"
    } else {
        mensajeFinal = `🤝 EMPATE TOTAL! ${victoriasJugador} vs ${victoriasEnemigo} 🤝`
        emojiFinal = "🤝"
    }
    
    const pFinal = document.createElement("p")
    pFinal.innerHTML = `${emojiFinal} ${mensajeFinal} ${emojiFinal}`
    pFinal.classList.add("mensaje-final")
    sectionMensajes.appendChild(pFinal)
  
    botonesAtaques.forEach(boton => {
        boton.disabled = true
    })
    
    sectionReiniciar.style.display = "block"
    ataqueJugador = []
    ataqueEnemigo = []
}

function pintarCanvas() {

    mascotaJugadorObjeto.x += mascotaJugadorObjeto.velocidadX
    mascotaJugadorObjeto.y += mascotaJugadorObjeto.velocidadY

    mascotaJugadorObjeto.x = Math.max(0, Math.min(mapa.width - mascotaJugadorObjeto.ancho, mascotaJugadorObjeto.x));
    mascotaJugadorObjeto.y = Math.max(0, Math.min(mapa.height - mascotaJugadorObjeto.alto, mascotaJugadorObjeto.y));

    lienzo.clearRect(0, 0, mapa.width, mapa.height);
    lienzo.drawImage(
        mapaBackground,
        0,
        0,
        mapa.width,
        mapa.height
    )

    mascotaJugadorObjeto.pintarAnimal()
    neptunoEnemigo.pintarAnimal()
    tierrudoEnemigo.pintarAnimal()
    salamanderEnemigo.pintarAnimal()

    if (mascotaJugadorObjeto.velocidadX !== 0 || mascotaJugadorObjeto.velocidadY !== 0) {
        revisarColision(neptunoEnemigo)
        revisarColision(tierrudoEnemigo)
        revisarColision(salamanderEnemigo)
    }
}

function moverArriba(){

    mascotaJugadorObjeto.velocidadY = -5
}
function moverIzquierda(){

    mascotaJugadorObjeto.velocidadX = -5
}
function moverAbajo(){

    mascotaJugadorObjeto.velocidadY = 5
}
function moverDerecha(){

    mascotaJugadorObjeto.velocidadX = 5
}
function detenerMovimiento(){

    mascotaJugadorObjeto.velocidadX = 0
    mascotaJugadorObjeto.velocidadY = 0
}
function teclaPresionada(event){
    switch (event.key) {
        case "ArrowUp":
            moverArriba()
            break
        case "ArrowDown":
            moverAbajo()
            break
        case "ArrowLeft":
            moverIzquierda()
            break
        case "ArrowRight":
            moverDerecha()
            break
        default:
            break
    }
}

function obtenerObjetoMascota() {

    for (let i = 0; i < animales.length; i++) {
        if (nombreMascotaJugador === animales[i].nombre) {
            return animales[i]
        }
    }
    return null
}

function revisarColision(enemigo){

    const colisionEnemigo = {
        x: enemigo.x + enemigo.offsetX,
        y: enemigo.y + enemigo.offsetY,
        ancho: enemigo.anchoColision,
        alto: enemigo.altoColision
    };
    const colisionJugador = {
        x: mascotaJugadorObjeto.x + mascotaJugadorObjeto.offsetX,
        y: mascotaJugadorObjeto.y + mascotaJugadorObjeto.offsetY,
        ancho: mascotaJugadorObjeto.anchoColision,
        alto: mascotaJugadorObjeto.altoColision
    };

    const hayColision = !(colisionJugador.x + colisionJugador.ancho < colisionEnemigo.x ||
        colisionJugador.x > colisionEnemigo.x + colisionEnemigo.ancho ||
        colisionJugador.y + colisionJugador.alto < colisionEnemigo.y ||
        colisionJugador.y > colisionEnemigo.y + colisionEnemigo.alto);

    if (hayColision && !colisionOcurrida) {
        colisionOcurrida = true;
        console.log("¡Colisión con", enemigo.nombre);
        
        iniciarCombateContra(enemigo);
    } else if (!hayColision) {
        colisionOcurrida = false;
    }
}

function iniciarCombateContra(enemigo) {
    
    clearInterval(intervalo);
    window.removeEventListener("keydown", teclaPresionada);
    window.removeEventListener("keyup", detenerMovimiento);
    
    ocultarMapa(); 
    
    nombreMascotaEnemigo = enemigo.nombre;
    spanMascotaEnemigo.innerHTML = nombreMascotaEnemigo;
   
    sectionSeleccionarAtaque.style.display = "flex";
    sectionMensajes.innerHTML = "⚔️ ¡Prepárate para el combate! ⚔️";
    
    ataqueJugador = [];
    ataqueEnemigo = [];
}

function reiniciarJuego() { 
    location.reload()
}