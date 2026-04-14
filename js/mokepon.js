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
let rondasJugador = 0
let rondasEnemigo = 0

//CLASES:
class Animal { 
    constructor(nombre, foto, vida) {
        this.nombre = nombre
        this.foto = foto
        this.vida = vida
        this.ataques = []
    }
}

//INSTANCIAS DE ANIMALES:
let neptuno = new Animal("Neptuno", "./assets/agua.webp", 3)
let tierrudo = new Animal("Tierrudo", "./assets/tierra.webp", 3)
let salamander = new Animal("Salamander", "./assets/fuego.webp", 3)

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
}
iniciarJuego(); 

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

    setTimeout(() => {
        sectionSeleccionarMascota.style.display = "none" 
        sectionSeleccionarAtaque.style.display = "flex"
        sectionMensajes.innerHTML = "⚔️ ¡Prepárate para el combate! ⚔️"
    }, 200);

    seleccionarMascotaEnemigo(); 
}

function seleccionarMascotaEnemigo() { 

    let mascotaAleatoria = aleatorio(0, animales.length -1) 
    nombreMascotaEnemigo = animales[mascotaAleatoria].nombre
    spanMascotaEnemigo.innerHTML = nombreMascotaEnemigo
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

function reiniciarJuego() { 
    location.reload()
}