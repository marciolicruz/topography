// app.js - Lógica Principal, Cálculos e Canvas da Calculadora Topográfica Web

// ==========================================================================
// Estruturas de Dados e Estado
// ==========================================================================
class TopoPoint {
    constructor(name, x, y, fromName, distance, deg, min, sec, isAzimuth, calculatedAzimuth) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.fromName = fromName;
        this.distance = distance;
        this.deg = deg;
        this.min = min;
        this.sec = sec;
        this.isAzimuth = isAzimuth;
        this.calculatedAzimuth = calculatedAzimuth;
    }
}

let startPoint = new TopoPoint("P0", 0.0, 0.0, "", 0.0, 0, 0, 0.0, true, 0.0);
let pointsList = [];
let userEditedExpected = false;

// Zoom e Pan do Canvas
let zoomFactor = 1.0;
let panX = 0;
let panY = 0;
let isDragging = false;
let startDragX = 0;
let startDragY = 0;

// Elementos da Interface Gráfica (DOM)
let canvas, ctx;

// ==========================================================================
// Inicialização do Aplicativo
// ==========================================================================
window.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("topo-canvas");
    ctx = canvas.getContext("2d");

    // Redimensionar canvas para o tamanho real do contêiner
    resizeCanvas();
    window.addEventListener("resize", () => {
        resizeCanvas();
        draw();
    });

    // Carregar dados salvos no localStorage
    loadSavedData();

    // Registrar Ouvintes de Eventos (EventListeners)
    registerEvents();

    // Atualizar visualizações
    updateUI();
});

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height || 380;
}

// ==========================================================================
// Persistência de Dados (LocalStorage)
// ==========================================================================
function saveData() {
    const data = {
        startPoint: startPoint,
        pointsList: pointsList,
        userEditedExpected: userEditedExpected,
        expectedX: document.getElementById("txt-expected-x").value,
        expectedY: document.getElementById("txt-expected-y").value
    };
    localStorage.setItem("topography_calculator_data", JSON.stringify(data));
}

function loadSavedData() {
    const saved = localStorage.getItem("topography_calculator_data");
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.startPoint) {
                startPoint = new TopoPoint(
                    data.startPoint.name,
                    data.startPoint.x,
                    data.startPoint.y,
                    data.startPoint.fromName,
                    data.startPoint.distance,
                    data.startPoint.deg,
                    data.startPoint.min,
                    data.startPoint.sec,
                    data.startPoint.isAzimuth,
                    data.startPoint.calculatedAzimuth
                );
            }
            if (data.pointsList && Array.isArray(data.pointsList)) {
                pointsList = data.pointsList.map(p => new TopoPoint(
                    p.name, p.x, p.y, p.fromName, p.distance,
                    p.deg, p.min, p.sec, p.isAzimuth, p.calculatedAzimuth
                ));
            }
            userEditedExpected = data.userEditedExpected || false;
            
            // Restaura inputs na tela
            document.getElementById("txt-start-name").value = startPoint.name;
            document.getElementById("txt-start-x").value = startPoint.x.toFixed(3);
            document.getElementById("txt-start-y").value = startPoint.y.toFixed(3);
            
            if (userEditedExpected) {
                document.getElementById("txt-expected-x").value = data.expectedX || "0.000";
                document.getElementById("txt-expected-y").value = data.expectedY || "0.000";
            }
        } catch (e) {
            console.error("Erro ao ler dados salvos do localStorage", e);
        }
    }
}

// ==========================================================================
// Parsing & Formatação (Tratamento de Locale - Ponto e Vírgula)
// ==========================================================================
function parseDoubleRobust(val) {
    if (typeof val !== "string") val = String(val);
    const normalized = val.trim().replace(",", ".");
    const parsed = parseFloat(normalized);
    if (isNaN(parsed)) {
        throw new NumberFormatException("Formato numérico inválido");
    }
    return parsed;
}

function formatDMS(angleDecimal) {
    const deg = Math.floor(angleDecimal);
    const remMin = (angleDecimal - deg) * 60.0;
    const min = Math.floor(remMin);
    const sec = (remMin - min) * 60.0;
    return `${deg}° ${min}' ${sec.toFixed(1)}"`;
}

// ==========================================================================
// Registrador de Eventos da Interface
// ==========================================================================
function registerEvents() {
    // 1. Atualizar ponto de partida
    document.getElementById("btn-update-start").addEventListener("click", () => {
        try {
            const newX = parseDoubleRobust(document.getElementById("txt-start-x").value);
            const newY = parseDoubleRobust(document.getElementById("txt-start-y").value);
            let name = document.getElementById("txt-start-name").value.trim();
            if (!name) name = "P0";

            const diffX = newX - startPoint.x;
            const diffY = newY - startPoint.y;

            startPoint.name = name;
            startPoint.x = newX;
            startPoint.y = newY;

            // Ajusta coordenadas acumuladas subsequentes
            pointsList.forEach(p => {
                p.x += diffX;
                p.y += diffY;
            });

            if (!userEditedExpected) {
                document.getElementById("txt-expected-x").value = newX.toFixed(3);
                document.getElementById("txt-expected-y").value = newY.toFixed(3);
            }

            saveData();
            updateUI();
        } catch (e) {
            alert("Por favor, insira valores válidos para as coordenadas do ponto inicial.");
        }
    });

    // 2. Adicionar nova visada
    document.getElementById("btn-add-point").addEventListener("click", addPoint);

    // Tecla Enter para submeter os campos
    document.getElementById("txt-distance").addEventListener("keypress", (e) => {
        if (e.key === "Enter") addPoint();
    });
    document.getElementById("txt-seconds").addEventListener("keypress", (e) => {
        if (e.key === "Enter") addPoint();
    });

    // 3. Operações gerais
    document.getElementById("btn-remove-last").addEventListener("click", () => {
        if (pointsList.length > 0) {
            pointsList.pop();
            saveData();
            updateUI();
        }
    });

    document.getElementById("btn-reset").addEventListener("click", () => {
        if (confirm("Deseja realmente apagar todos os pontos da poligonal?")) {
            pointsList = [];
            userEditedExpected = false;
            
            // Reseta para a origem default
            startPoint = new TopoPoint("P0", 0.0, 0.0, "", 0.0, 0, 0, 0.0, true, 0.0);
            document.getElementById("txt-start-name").value = "P0";
            document.getElementById("txt-start-x").value = "0.000";
            document.getElementById("txt-start-y").value = "0.000";
            
            document.getElementById("txt-expected-x").value = "0.000";
            document.getElementById("txt-expected-y").value = "0.000";
            
            saveData();
            updateUI();
        }
    });

    document.getElementById("btn-export").addEventListener("click", exportToCSV);

    // 4. Fechamento esperado (Eventos de alteração manual)
    const expectedXInput = document.getElementById("txt-expected-x");
    const expectedYInput = document.getElementById("txt-expected-y");

    expectedXInput.addEventListener("focus", () => { userEditedExpected = true; });
    expectedXInput.addEventListener("blur", () => { saveData(); updateClosurePanel(); });
    expectedYInput.addEventListener("focus", () => { userEditedExpected = true; });
    expectedYInput.addEventListener("blur", () => { saveData(); updateClosurePanel(); });

    // 5. Controles de Zoom do Canvas
    document.getElementById("btn-zoom-in").addEventListener("click", () => {
        zoomFactor *= 1.25;
        draw();
    });
    document.getElementById("btn-zoom-out").addEventListener("click", () => {
        zoomFactor /= 1.25;
        draw();
    });
    document.getElementById("btn-zoom-reset").addEventListener("click", () => {
        zoomFactor = 1.0;
        panX = 0;
        panY = 0;
        draw();
    });

    // 6. Arrastar e Mover (Pan) no Canvas
    canvas.addEventListener("mousedown", (e) => {
        isDragging = true;
        startDragX = e.clientX - panX;
        startDragY = e.clientY - panY;
    });

    canvas.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        panX = e.clientX - startDragX;
        panY = e.clientY - startDragY;
        draw();
    });

    window.addEventListener("mouseup", () => {
        isDragging = false;
    });

    // Zoom por Scroll no Canvas
    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const factor = 1.1;
        if (e.deltaY < 0) {
            zoomFactor *= factor;
        } else {
            zoomFactor /= factor;
        }
        zoomFactor = Math.max(0.1, Math.min(30, zoomFactor));
        draw();
    });
}

// ==========================================================================
// Lógica de Lançamento de Ponto (Traverse calculation)
// ==========================================================================
function addPoint() {
    const toName = document.getElementById("txt-to-point").value.trim();
    const distanceStr = document.getElementById("txt-distance").value.trim();
    const degStr = document.getElementById("txt-degrees").value.trim();
    const min = parseInt(document.getElementById("num-minutes").value) || 0;
    const secStr = document.getElementById("txt-seconds").value.trim();
    
    if (!toName) {
        alert("Digite o nome do ponto de destino.");
        return;
    }
    
    let deg, distance, sec;
    try {
        deg = parseDoubleRobust(degStr);
        distance = parseDoubleRobust(distanceStr);
        sec = parseDoubleRobust(secStr);
    } catch (e) {
        alert("Graus, distância e segundos devem ser numéricos.");
        return;
    }
    
    if (distance < 0) {
        alert("A distância deve ser positiva.");
        return;
    }
    
    if (sec < 0 || sec >= 60) {
        alert("Segundos devem estar entre 0 e 59.99.");
        return;
    }
    
    // Calcula o ângulo em graus decimais
    const inputDecimalDegrees = deg + (min / 60.0) + (sec / 3600.0);
    
    // O primeiro ponto exige Azimute
    const isAzimuth = document.getElementById("sel-angle-type").value === "azimuth" || pointsList.length === 0;
    let calculatedAzimuth;
    
    if (isAzimuth) {
        calculatedAzimuth = inputDecimalDegrees;
    } else {
        // Formula: Az_i = (Az_prev + HZ + 180) % 360
        const prevAz = pointsList[pointsList.length - 1].calculatedAzimuth;
        calculatedAzimuth = (prevAz + inputDecimalDegrees + 180.0) % 360.0;
        if (calculatedAzimuth < 0) {
            calculatedAzimuth += 360.0;
        }
    }
    
    const rad = (calculatedAzimuth * Math.PI) / 180.0;
    
    // Delta X = Distancia * sen(Azimute)
    // Delta Y = Distancia * cos(Azimute)
    const deltaX = distance * Math.sin(rad);
    const deltaY = distance * Math.cos(rad);
    
    const prevX = pointsList.length === 0 ? startPoint.x : pointsList[pointsList.length - 1].x;
    const prevY = pointsList.length === 0 ? startPoint.y : pointsList[pointsList.length - 1].y;
    const fromName = pointsList.length === 0 ? startPoint.name : pointsList[pointsList.length - 1].name;
    
    const newX = prevX + deltaX;
    const newY = prevY + deltaY;
    
    // Normaliza o ângulo inserido de volta para DMS para manter a consistência da tabela e do CSV
    const normDeg = Math.floor(inputDecimalDegrees);
    const remMin = (inputDecimalDegrees - normDeg) * 60.0;
    const normMin = Math.floor(remMin);
    const normSec = (remMin - normMin) * 60.0;

    const newPoint = new TopoPoint(toName, newX, newY, fromName, distance, normDeg, normMin, normSec, isAzimuth, calculatedAzimuth);
    pointsList.push(newPoint);
    
    // Salvar e atualizar interface
    saveData();
    updateUI();
    
    // Reseta entradas de distância e ângulos
    document.getElementById("txt-distance").value = "";
    document.getElementById("txt-degrees").value = "0";
    document.getElementById("num-minutes").value = 0;
    document.getElementById("txt-seconds").value = "0.0";
    
    // Foca na distância para o próximo lançamento
    document.getElementById("txt-distance").focus();
}

// ==========================================================================
// Atualização de Rótulos, Tabela e Painéis da Interface
// ==========================================================================
function updateUI() {
    updateFromLabel();
    refreshTable();
    updateClosurePanel();
    draw();
}

function updateFromLabel() {
    const selAngleType = document.getElementById("sel-angle-type");
    const lblFromPoint = document.getElementById("lbl-from-point");
    const txtToPoint = document.getElementById("txt-to-point");
    
    if (pointsList.length === 0) {
        lblFromPoint.textContent = startPoint.name;
        txtToPoint.value = "P1";
        selAngleType.value = "azimuth";
        selAngleType.disabled = true; // O primeiro ponto exige Azimute
    } else {
        lblFromPoint.textContent = pointsList[pointsList.length - 1].name;
        txtToPoint.value = "P" + (pointsList.length + 1);
        selAngleType.disabled = false;
        selAngleType.value = "angle"; // Default é Ângulo Horário (Ré)
    }
}

function refreshTable() {
    const tbody = document.getElementById("tbl-body");
    tbody.innerHTML = "";

    // 1. Linha 0: Ponto Inicial
    const startRow = document.createElement("tr");
    startRow.innerHTML = `
        <td>-</td>
        <td style="font-weight: 700;">${startPoint.name}</td>
        <td>0.00</td>
        <td>-</td>
        <td>-</td>
        <td>0.000</td>
        <td>0.000</td>
        <td style="font-family: var(--font-heading); font-weight: 600; color: #fff;">${startPoint.x.toFixed(3)}</td>
        <td style="font-family: var(--font-heading); font-weight: 600; color: #fff;">${startPoint.y.toFixed(3)}</td>
    `;
    tbody.appendChild(startRow);

    // 2. Linhas seguintes
    pointsList.forEach((p, idx) => {
        const prevX = (idx === 0) ? startPoint.x : pointsList[idx - 1].x;
        const prevY = (idx === 0) ? startPoint.y : pointsList[idx - 1].y;
        
        const dX = p.x - prevX;
        const dY = p.y - prevY;
        
        const angleLabelClass = p.isAzimuth ? "angle-tag-az" : "angle-tag-hz";
        const angleLabelText = p.isAzimuth ? "Az" : "HZ";
        const inputAngleDMS = `<span class="${angleLabelClass}">${angleLabelText}</span> ${p.deg}° ${p.min}' ${p.sec.toFixed(1)}"`;
        const calcAzDMS = formatDMS(p.calculatedAzimuth);

        const dXStr = dX >= 0 ? `+${dX.toFixed(3)}` : dX.toFixed(3);
        const dYStr = dY >= 0 ? `+${dY.toFixed(3)}` : dY.toFixed(3);

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${p.fromName}</td>
            <td style="font-weight: 700; color: var(--secondary);">${p.name}</td>
            <td>${p.distance.toFixed(2)}</td>
            <td>${inputAngleDMS}</td>
            <td>${calcAzDMS}</td>
            <td style="color: ${dX >= 0 ? 'var(--success)' : 'var(--danger)'};">${dXStr}</td>
            <td style="color: ${dY >= 0 ? 'var(--success)' : 'var(--danger)'};">${dYStr}</td>
            <td style="font-family: var(--font-heading); font-weight: 600; color: #fff;">${p.x.toFixed(3)}</td>
            <td style="font-family: var(--font-heading); font-weight: 600; color: #fff;">${p.y.toFixed(3)}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateClosurePanel() {
    const valPerimeter = document.getElementById("val-perimeter");
    const valErrX = document.getElementById("val-err-x");
    const valErrY = document.getElementById("val-err-y");
    const valErrLinear = document.getElementById("val-err-linear");
    const valPrecision = document.getElementById("val-precision");

    if (pointsList.length === 0) {
        valPerimeter.textContent = "-";
        valErrX.textContent = "-";
        valErrY.textContent = "-";
        valErrLinear.textContent = "-";
        valPrecision.textContent = "-";
        valPrecision.style.color = "var(--color-text-muted)";
        return;
    }

    // Se o usuário não editou manualmente, sincroniza X/Y esperado com o ponto inicial (origem)
    if (!userEditedExpected) {
        document.getElementById("txt-expected-x").value = startPoint.x.toFixed(3);
        document.getElementById("txt-expected-y").value = startPoint.y.toFixed(3);
    }

    try {
        const expX = parseDoubleRobust(document.getElementById("txt-expected-x").value);
        const expY = parseDoubleRobust(document.getElementById("txt-expected-y").value);

        const lastPoint = pointsList[pointsList.length - 1];
        const errX = lastPoint.x - expX;
        const errY = lastPoint.y - expY;
        const errL = Math.sqrt(errX * errX + errY * errY);

        // Perímetro total
        let perimeter = 0;
        pointsList.forEach(p => {
            perimeter += p.distance;
        });

        valPerimeter.textContent = `${perimeter.toFixed(3)} m`;
        
        const errXSign = errX >= 0 ? "+" : "";
        const errYSign = errY >= 0 ? "+" : "";
        valErrX.textContent = `${errXSign}${errX.toFixed(4)} m`;
        valErrY.textContent = `${errYSign}${errY.toFixed(4)} m`;
        valErrLinear.textContent = `${errL.toFixed(4)} m`;

        if (errL > 1e-9) {
            const ratio = Math.round(perimeter / errL);
            valPrecision.textContent = `1 : ${ratio.toLocaleString()}`;
            
            // Coloração conforme qualidade
            if (ratio >= 5000) {
                valPrecision.style.color = "var(--secondary)"; // Verde/Ciano
            } else if (ratio >= 1000) {
                valPrecision.style.color = "var(--warning)"; // Amarelo
            } else {
                valPrecision.style.color = "var(--danger)"; // Vermelho
            }
        } else {
            valPrecision.textContent = "Fechamento Perfeito";
            valPrecision.style.color = "var(--secondary)";
        }

    } catch (e) {
        valErrX.textContent = "Erro!";
        valErrY.textContent = "Erro!";
        valErrLinear.textContent = "Erro!";
        valPrecision.textContent = "Verifique X/Y esperado";
        valPrecision.style.color = "var(--danger)";
    }
}

// ==========================================================================
// Motor de Desenho Gráfico (HTML5 Canvas)
// ==========================================================================
function draw() {
    if (!canvas || !ctx) return;

    // Limpar o canvas
    ctx.fillStyle = "#0b0b10";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const allPoints = [startPoint, ...pointsList];

    // 1. Achar caixa envolvente
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    allPoints.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    let diffX = maxX - minX;
    let diffY = maxY - minY;

    // Evitar divisão por zero caso haja apenas um ponto
    if (diffX < 1e-5) diffX = 10.0;
    if (diffY < 1e-5) diffY = 10.0;

    // Adiciona padding de 15% nas bordas do desenho para não cortar nomes
    minX -= diffX * 0.15;
    maxX += diffX * 0.15;
    minY -= diffY * 0.15;
    maxY += diffY * 0.15;

    diffX = maxX - minX;
    diffY = maxY - minY;

    // 2. Fator de escala mantendo a proporção (uniform scaling)
    const padding = 40;
    const scaleX = (canvas.width - 2 * padding) / diffX;
    const scaleY = (canvas.height - 2 * padding) / diffY;
    const baseScale = Math.min(scaleX, scaleY);
    
    // Escala final aplicando o zoom do usuário
    const scale = baseScale * zoomFactor;

    // Centraliza o desenho no canvas
    const offsetX = padding + (canvas.width - 2 * padding - diffX * scale) / 2;
    const offsetY = padding + (canvas.height - 2 * padding - diffY * scale) / 2;

    // Função interna auxiliar para converter Coordenada Geodésica (X, Y) -> Pixels da Tela (sx, sy)
    function toScreen(x, y) {
        const sx = offsetX + (x - minX) * scale + panX;
        // Inverte o eixo Y pois em topografia cresce para cima, e em canvas para baixo
        const sy = canvas.height - (offsetY + (y - minY) * scale + panY);
        return { x: sx, y: sy };
    }

    // 3. Desenhar a Grade de Fundo (Grid)
    ctx.strokeStyle = "#1b1b26";
    ctx.lineWidth = 1.0;
    const gridSpacing = 40;
    
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += gridSpacing) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    for (let y = 0; y < canvas.height; y += gridSpacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // Desenhar eixos cartesianos principais (X=0 e Y=0) se estiverem visíveis
    if (minX <= 0 && maxX >= 0) {
        const zeroScreen = toScreen(0, startPoint.y);
        ctx.strokeStyle = "#2d2d3f";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(zeroScreen.x, 0);
        ctx.lineTo(zeroScreen.x, canvas.height);
        ctx.stroke();
    }
    if (minY <= 0 && maxY >= 0) {
        const zeroScreen = toScreen(startPoint.x, 0);
        ctx.strokeStyle = "#2d2d3f";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, zeroScreen.y);
        ctx.lineTo(canvas.width, zeroScreen.y);
        ctx.stroke();
    }

    // 4. Desenhar as linhas de conexão do trajeto
    if (allPoints.length > 1) {
        ctx.strokeStyle = "rgba(108, 92, 231, 0.85)"; // Neon purple
        ctx.lineWidth = 3.0;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        
        const first = toScreen(allPoints[0].x, allPoints[0].y);
        ctx.moveTo(first.x, first.y);

        for (let i = 1; i < allPoints.length; i++) {
            const pt = toScreen(allPoints[i].x, allPoints[i].y);
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
    }

    // 5. Desenhar balões com o Azimute absoluto de cada trecho no gráfico
    ctx.font = "bold 9px 'Inter', sans-serif";
    for (let i = 1; i < allPoints.length; i++) {
        const pt1 = toScreen(allPoints[i - 1].x, allPoints[i - 1].y);
        const pt2 = toScreen(allPoints[i].x, allPoints[i].y);

        // Ponto médio da linha
        const mx = (pt1.x + pt2.x) / 2;
        const my = (pt1.y + pt2.y) / 2;

        // Ângulo de azimute formatado
        const azStr = formatDMS(allPoints[i].calculatedAzimuth);

        // Medir o balão de texto
        const metrics = ctx.measureText(azStr);
        const textWidth = metrics.width;
        const textHeight = 10;

        // Fundo escuro opaco do balão
        ctx.fillStyle = "rgba(11, 11, 16, 0.95)";
        ctx.beginPath();
        const rx = mx - textWidth / 2 - 5;
        const ry = my - textHeight / 2 - 3;
        const rw = textWidth + 10;
        const rh = textHeight + 6;
        ctx.rect(rx, ry, rw, rh);
        ctx.fill();

        // Borda roxa fina
        ctx.strokeStyle = "rgba(108, 92, 231, 0.7)";
        ctx.lineWidth = 1.0;
        ctx.stroke();

        // Texto em amarelo destacado (cor literal #ffe66d)
        ctx.fillStyle = "#ffe66d";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(azStr, mx, my + 1);
    }

    // 6. Desenhar os nós dos pontos (Origem e Vantes)
    allPoints.forEach((p, idx) => {
        const pt = toScreen(p.x, p.y);

        // Círculo externo branco (borda)
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, 2 * Math.PI);
        ctx.fill();

        // Miolo colorido (cores literais #00d2d3 para origem e #ff7675 para vantes)
        ctx.fillStyle = (idx === 0) ? "#00d2d3" : "#ff7675";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4.5, 0, 2 * Math.PI);
        ctx.fill();

        // Nome do ponto
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px 'Outfit', sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(p.name, pt.x + 10, pt.y - 4);

        // Coordenadas pequenas (cor literal #9595a8)
        ctx.fillStyle = "#9595a8";
        ctx.font = "500 9px 'Inter', sans-serif";
        ctx.textBaseline = "top";
        ctx.fillText(`X:${p.x.toFixed(1)} Y:${p.y.toFixed(1)}`, pt.x + 10, pt.y + 2);
    });
}

// ==========================================================================
// Exportar para Arquivo CSV
// ==========================================================================
function exportToCSV() {
    if (pointsList.length === 0) {
        alert("Não há dados de poligonal para exportar.");
        return;
    }

    let csvContent = "De,Para,Distancia (m),Angulo Lido,Azimute Calculado,Delta X (m),Delta Y (m),Coord X (m),Coord Y (m)\n";
    
    // 1. Linha da Origem
    csvContent += `-,${startPoint.name},0.00,-,-,0.000,0.000,${startPoint.x.toFixed(3)},${startPoint.y.toFixed(3)}\n`;

    // 2. Pontos seguintes
    pointsList.forEach((p, idx) => {
        const prevX = (idx === 0) ? startPoint.x : pointsList[idx - 1].x;
        const prevY = (idx === 0) ? startPoint.y : pointsList[idx - 1].y;
        
        const dX = p.x - prevX;
        const dY = p.y - prevY;
        
        const angleLabelText = p.isAzimuth ? "Az" : "HZ";
        const inputAngleDMS = `${angleLabelText}: ${p.deg}d ${p.min}m ${p.sec.toFixed(1)}s`;
        const calcAzDMS = formatDMS(p.calculatedAzimuth).replace("°", "d").replace("'", "m").replace('"', "s");

        csvContent += `${p.fromName},${p.name},${p.distance.toFixed(2)},${inputAngleDMS},${calcAzDMS},${dX.toFixed(3)},${dY.toFixed(3)},${p.x.toFixed(3)},${p.y.toFixed(3)}\n`;
    });

    // Força o download do arquivo no navegador
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `poligonal_${startPoint.name}_to_${pointsList[pointsList.length - 1].name}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
