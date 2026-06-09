// app.js - Lógica Principal, Cálculos, Delaunay, Curvas de Nível e Canvas

// ==========================================================================
// Estruturas de Dados e Estado
// ==========================================================================
class TopoPoint {
    constructor(name, x, y, fromName, distance, deg, min, sec, isAzimuth, calculatedAzimuth, z = 0.0) {
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
        this.z = z;
    }
}

class AltimetryPoint {
    constructor(name, x, y, z) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

// Classe Triângulo para o algoritmo de Bowyer-Watson (Triangulação de Delaunay)
class Triangle {
    constructor(p1, p2, p3) {
        this.p1 = p1; // ponto { name, x, y, z }
        this.p2 = p2;
        this.p3 = p3;
    }
    
    // Calcula circuncentro e raio circunscrito ao quadrado (r^2)
    getCircumcircle() {
        const x1 = this.p1.x, y1 = this.p1.y;
        const x2 = this.p2.x, y2 = this.p2.y;
        const x3 = this.p3.x, y3 = this.p3.y;
        
        const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
        if (Math.abs(d) < 1e-9) {
            return { x: 0, y: 0, r2: Infinity };
        }
        
        const ux = ((x1*x1 + y1*y1) * (y2 - y3) + (x2*x2 + y2*y2) * (y3 - y1) + (x3*x3 + y3*y3) * (y1 - y2)) / d;
        const uy = ((x1*x1 + y1*y1) * (x3 - x2) + (x2*x2 + y2*y2) * (x1 - x3) + (x3*x3 + y3*y3) * (x2 - x1)) / d;
        
        const r2 = (x1 - ux)*(x1 - ux) + (y1 - uy)*(y1 - uy);
        return { x: ux, y: uy, r2: r2 };
    }
}

// Variáveis Globais de Estado
let startPoint = new TopoPoint("P0", 0.0, 0.0, "", 0.0, 0, 0, 0.0, true, 0.0, 0.0);
let pointsList = [];
let altPointsList = [];
let activeTab = "planimetria";
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
        altPointsList: altPointsList,
        userEditedExpected: userEditedExpected,
        expectedX: document.getElementById("txt-expected-x").value,
        expectedY: document.getElementById("txt-expected-y").value,
        activeTab: activeTab,
        
        // Altimetria Configs
        contourInterval: document.getElementById("txt-contour-interval").value,
        masterInterval: document.getElementById("num-master-interval").value,
        showContours: document.getElementById("chk-show-contours").checked,
        showTin: document.getElementById("chk-show-tin").checked,
        showLabels: document.getElementById("chk-show-labels").checked
    };
    localStorage.setItem("topography_calculator_data_v2", JSON.stringify(data));
}

function loadSavedData() {
    const saved = localStorage.getItem("topography_calculator_data_v2");
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
                    data.startPoint.calculatedAzimuth,
                    data.startPoint.z || 0.0
                );
            }
            if (data.pointsList && Array.isArray(data.pointsList)) {
                pointsList = data.pointsList.map(p => new TopoPoint(
                    p.name, p.x, p.y, p.fromName, p.distance,
                    p.deg, p.min, p.sec, p.isAzimuth, p.calculatedAzimuth, p.z || 0.0
                ));
            }
            if (data.altPointsList && Array.isArray(data.altPointsList)) {
                altPointsList = data.altPointsList.map(p => new AltimetryPoint(
                    p.name, p.x, p.y, p.z
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

            // Altimetria Configs
            if (data.contourInterval) document.getElementById("txt-contour-interval").value = data.contourInterval;
            if (data.masterInterval) document.getElementById("num-master-interval").value = data.masterInterval;
            if (data.showContours !== undefined) document.getElementById("chk-show-contours").checked = data.showContours;
            if (data.showTin !== undefined) document.getElementById("chk-show-tin").checked = data.showTin;
            if (data.showLabels !== undefined) document.getElementById("chk-show-labels").checked = data.showLabels;

            if (data.activeTab) {
                activeTab = data.activeTab;
            }
        } catch (e) {
            console.error("Erro ao ler dados salvos do localStorage", e);
        }
    }
    
    // Aplica a aba ativa
    switchTab(activeTab);
}

// ==========================================================================
// Parsing & Formatação (Tratamento de Locale - Ponto e Vírgula)
// ==========================================================================
function parseDoubleRobust(val) {
    if (typeof val !== "string") val = String(val);
    const normalized = val.trim().replace(",", ".");
    const parsed = parseFloat(normalized);
    if (isNaN(parsed)) {
        throw new Error("Formato numérico inválido");
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
    // 1. Alternar Abas
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetTab = e.target.getAttribute("data-tab");
            switchTab(targetTab);
        });
    });

    // 2. Atualizar ponto de partida (Planimetria)
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

    // 3. Adicionar nova visada (Planimetria)
    document.getElementById("btn-add-point").addEventListener("click", addPoint);

    // Teclas Enter nos campos de Planimetria
    document.getElementById("txt-distance").addEventListener("keypress", (e) => {
        if (e.key === "Enter") addPoint();
    });
    document.getElementById("txt-seconds").addEventListener("keypress", (e) => {
        if (e.key === "Enter") addPoint();
    });

    // 4. Operações de Planimetria
    document.getElementById("btn-remove-last").addEventListener("click", () => {
        if (pointsList.length > 0) {
            pointsList.pop();
            saveData();
            updateUI();
        }
    });

    document.getElementById("btn-reset").addEventListener("click", () => {
        if (confirm("Deseja realmente apagar toda a planimetria da poligonal?")) {
            pointsList = [];
            userEditedExpected = false;
            
            // Reseta para a origem default
            startPoint = new TopoPoint("P0", 0.0, 0.0, "", 0.0, 0, 0, 0.0, true, 0.0, startPoint.z);
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
    document.getElementById("btn-export-dxf").addEventListener("click", exportToDXF);
    document.getElementById("btn-export-dxf-alt").addEventListener("click", exportToDXF);

    // 5. Fechamento esperado (Planimetria)
    const expectedXInput = document.getElementById("txt-expected-x");
    const expectedYInput = document.getElementById("txt-expected-y");

    expectedXInput.addEventListener("focus", () => { userEditedExpected = true; });
    expectedXInput.addEventListener("blur", () => { saveData(); updateClosurePanel(); });
    expectedYInput.addEventListener("focus", () => { userEditedExpected = true; });
    expectedYInput.addEventListener("blur", () => { saveData(); updateClosurePanel(); });

    // 6. Atualizar Cota Z de ponto da poligonal (Altimetria)
    document.getElementById("btn-update-z").addEventListener("click", () => {
        const pointName = document.getElementById("sel-z-point").value;
        const zStr = document.getElementById("txt-z-value").value;
        try {
            const zVal = parseDoubleRobust(zStr);
            if (startPoint.name === pointName) {
                startPoint.z = zVal;
            } else {
                const pt = pointsList.find(p => p.name === pointName);
                if (pt) pt.z = zVal;
            }
            saveData();
            updateUI();
            updateZPointDropdown();
        } catch (e) {
            alert("Insira uma cota Z válida (Exemplo: 100.52).");
        }
    });

    // 7. Adicionar Ponto Cotado / Irradiado (Altimetria)
    document.getElementById("btn-add-irr").addEventListener("click", () => {
        const name = document.getElementById("txt-irr-name").value.trim();
        const xStr = document.getElementById("txt-irr-x").value;
        const yStr = document.getElementById("txt-irr-y").value;
        const zStr = document.getElementById("txt-irr-z").value;
        
        if (!name) {
            alert("Digite o nome do ponto cotado.");
            return;
        }
        
        try {
            const x = parseDoubleRobust(xStr);
            const y = parseDoubleRobust(yStr);
            const z = parseDoubleRobust(zStr);
            
            const newIrr = new AltimetryPoint(name, x, y, z);
            altPointsList.push(newIrr);
            
            // Incrementa sugestão de nome
            document.getElementById("txt-irr-name").value = "I" + (altPointsList.length + 1);
            document.getElementById("txt-irr-x").value = "";
            document.getElementById("txt-irr-y").value = "";
            document.getElementById("txt-irr-z").value = "";
            
            saveData();
            updateUI();
        } catch (e) {
            alert("Verifique os valores de X, Y e Z. Devem ser numéricos.");
        }
    });

    // Teclas Enter no formulário de Pontos Cotados
    document.getElementById("txt-irr-z").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            document.getElementById("btn-add-irr").click();
        }
    });

    // 8. Operações de Altimetria
    document.getElementById("btn-remove-last-irr").addEventListener("click", () => {
        if (altPointsList.length > 0) {
            altPointsList.pop();
            document.getElementById("txt-irr-name").value = "I" + (altPointsList.length + 1);
            saveData();
            updateUI();
        }
    });

    document.getElementById("btn-reset-alt").addEventListener("click", () => {
        if (confirm("Deseja realmente apagar todos os dados de altimetria? (As cotas Z da poligonal voltarão para 0)")) {
            startPoint.z = 0.0;
            pointsList.forEach(p => p.z = 0.0);
            altPointsList = [];
            document.getElementById("txt-irr-name").value = "I1";
            saveData();
            updateUI();
        }
    });

    // 9. Configurações de Curva de Nível (Ouvir mudanças de inputs e checkboxes)
    document.getElementById("txt-contour-interval").addEventListener("change", () => {
        try {
            parseDoubleRobust(document.getElementById("txt-contour-interval").value);
            saveData();
            draw();
        } catch (e) {
            alert("Valor de Equidistância inválido.");
            document.getElementById("txt-contour-interval").value = "1.0";
        }
    });
    
    document.getElementById("num-master-interval").addEventListener("change", () => {
        saveData();
        draw();
    });

    document.getElementById("chk-show-contours").addEventListener("change", () => { saveData(); draw(); });
    document.getElementById("chk-show-tin").addEventListener("change", () => { saveData(); draw(); });
    document.getElementById("chk-show-labels").addEventListener("change", () => { saveData(); draw(); });

    // 10. Controles de Zoom do Canvas
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

    // 11. Arrastar e Mover (Pan) no Canvas
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

// Alternar entre abas Planimetria e Altimetria
function switchTab(tabName) {
    activeTab = tabName;
    
    // Atualiza classes ativas nos botões de abas
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
    });
    
    // Atualiza sidebar content
    document.querySelectorAll(".sidebar-tab-content").forEach(content => {
        content.classList.toggle("active", content.id === `sidebar-${tabName}`);
    });
    
    // Atualiza workspace content
    document.querySelectorAll(".workspace-tab-content").forEach(content => {
        content.classList.toggle("active", content.id === `workspace-${tabName}`);
    });
    
    // Atualiza o badge do visualizador
    const badge = document.getElementById("visualizer-mode");
    if (badge) {
        badge.textContent = tabName === "planimetria" ? "Planimetria" : "Altimetria";
        badge.className = `visualizer-badge ${tabName === "planimetria" ? "planimetria-mode" : "altimetry-mode"}`;
    }
    
    // Se mudou para altimetria, sincroniza o dropdown de pontos da poligonal
    if (tabName === "altimetria") {
        updateZPointDropdown();
    }
    
    saveData();
    draw();
}

function updateZPointDropdown() {
    const select = document.getElementById("sel-z-point");
    if (!select) return;
    
    const currentValue = select.value;
    select.innerHTML = "";
    
    // Adiciona ponto inicial
    const optStart = document.createElement("option");
    optStart.value = startPoint.name;
    optStart.textContent = `${startPoint.name} (Z: ${startPoint.z.toFixed(3)}m)`;
    select.appendChild(optStart);
    
    // Adiciona pontos da poligonal
    pointsList.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.name;
        opt.textContent = `${p.name} (Z: ${p.z.toFixed(3)}m)`;
        select.appendChild(opt);
    });

    // Tenta re-selecionar o que estava selecionado antes
    if (currentValue) {
        select.value = currentValue;
    }
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
    
    // Normaliza o ângulo de entrada de volta para DMS para consistência
    const normDeg = Math.floor(inputDecimalDegrees);
    const remMin = (inputDecimalDegrees - normDeg) * 60.0;
    const normMin = Math.floor(remMin);
    const normSec = (remMin - normMin) * 60.0;

    // Novo ponto criado com Z default = 0.0
    const newPoint = new TopoPoint(toName, newX, newY, fromName, distance, normDeg, normMin, normSec, isAzimuth, calculatedAzimuth, 0.0);
    pointsList.push(newPoint);
    
    // Salvar e atualizar interface
    saveData();
    updateUI();
    
    // Reseta entradas
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
    refreshAltimetryTable();
    updateClosurePanel();
    draw();
}

function updateFromLabel() {
    const selAngleType = document.getElementById("sel-angle-type");
    const lblFromPoint = document.getElementById("lbl-from-point");
    const txtToPoint = document.getElementById("txt-to-point");
    
    if (!selAngleType || !lblFromPoint || !txtToPoint) return;
    
    if (pointsList.length === 0) {
        lblFromPoint.textContent = startPoint.name;
        txtToPoint.value = "P1";
        selAngleType.value = "azimuth";
        selAngleType.disabled = true;
    } else {
        lblFromPoint.textContent = pointsList[pointsList.length - 1].name;
        txtToPoint.value = "P" + (pointsList.length + 1);
        selAngleType.disabled = false;
        selAngleType.value = "angle";
    }
}

function refreshTable() {
    const tbody = document.getElementById("tbl-body");
    if (!tbody) return;
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

function refreshAltimetryTable() {
    const tbody = document.getElementById("tbl-alt-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    // 1. Pontos da poligonal
    const startRow = document.createElement("tr");
    startRow.innerHTML = `
        <td style="font-weight: 700;">${startPoint.name}</td>
        <td><span class="angle-tag-az">Poligonal</span></td>
        <td>${startPoint.x.toFixed(3)}</td>
        <td>${startPoint.y.toFixed(3)}</td>
        <td style="font-family: var(--font-heading); font-weight: 700; color: var(--secondary);">${startPoint.z.toFixed(3)}</td>
        <td>-</td>
    `;
    tbody.appendChild(startRow);
    
    pointsList.forEach(p => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td style="font-weight: 700;">${p.name}</td>
            <td><span class="angle-tag-az">Poligonal</span></td>
            <td>${p.x.toFixed(3)}</td>
            <td>${p.y.toFixed(3)}</td>
            <td style="font-family: var(--font-heading); font-weight: 700; color: var(--secondary);">${p.z.toFixed(3)}</td>
            <td>-</td>
        `;
        tbody.appendChild(row);
    });
    
    // 2. Pontos cotados/irradiados
    altPointsList.forEach((p, idx) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td style="font-weight: 700; color: var(--danger);">${p.name}</td>
            <td><span class="angle-tag-hz">Cotado</span></td>
            <td>${p.x.toFixed(3)}</td>
            <td>${p.y.toFixed(3)}</td>
            <td style="font-family: var(--font-heading); font-weight: 700; color: var(--warning);">${p.z.toFixed(3)}</td>
            <td>
                <button class="btn-table-danger" onclick="removeAltimetryPoint(${idx})">Remover</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Tornar global para acesso da tabela
window.removeAltimetryPoint = function(idx) {
    if (idx >= 0 && idx < altPointsList.length) {
        altPointsList.splice(idx, 1);
        document.getElementById("txt-irr-name").value = "I" + (altPointsList.length + 1);
        saveData();
        updateUI();
    }
};

function updateClosurePanel() {
    const valPerimeter = document.getElementById("val-perimeter");
    const valErrX = document.getElementById("val-err-x");
    const valErrY = document.getElementById("val-err-y");
    const valErrLinear = document.getElementById("val-err-linear");
    const valPrecision = document.getElementById("val-precision");

    if (!valPerimeter) return;

    if (pointsList.length === 0) {
        valPerimeter.textContent = "-";
        valErrX.textContent = "-";
        valErrY.textContent = "-";
        valErrLinear.textContent = "-";
        valPrecision.textContent = "-";
        return;
    }

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
            
            if (ratio >= 5000) {
                valPrecision.style.color = "var(--secondary)";
            } else if (ratio >= 1000) {
                valPrecision.style.color = "var(--warning)";
            } else {
                valPrecision.style.color = "var(--danger)";
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
// ALGORITMO DE TRIANGULAÇÃO DE DELAUNAY (Bowyer-Watson)
// ==========================================================================
function triangulate(points) {
    if (points.length < 3) return [];
    
    // 1. Encontrar caixa envolvente dos pontos
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });
    
    const dx = maxX - minX;
    const dy = maxY - minY;
    const deltaMax = Math.max(dx, dy);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    
    // Super-triângulo que envelopa com folga todos os pontos
    const p1 = { name: "ST1", x: midX - 20 * deltaMax, y: midY - deltaMax, z: 0.0 };
    const p2 = { name: "ST2", x: midX, y: midY + 20 * deltaMax, z: 0.0 };
    const p3 = { name: "ST3", x: midX + 20 * deltaMax, y: midY - deltaMax, z: 0.0 };
    
    let triangles = [new Triangle(p1, p2, p3)];
    
    // 2. Inserir recursivamente cada ponto no TIN
    points.forEach(p => {
        let badTriangles = [];
        
        triangles.forEach(t => {
            const cc = t.getCircumcircle();
            const dist2 = (p.x - cc.x)*(p.x - cc.x) + (p.y - cc.y)*(p.y - cc.y);
            // Se o ponto está dentro do círculo circunscrito do triângulo
            if (dist2 <= cc.r2) {
                badTriangles.push(t);
            }
        });
        
        // Encontrar as arestas de fronteira da cavidade
        let polygon = [];
        badTriangles.forEach(t => {
            const edges = [
                { a: t.p1, b: t.p2 },
                { a: t.p2, b: t.p3 },
                { a: t.p3, b: t.p1 }
            ];
            
            edges.forEach(edge => {
                let shared = false;
                badTriangles.forEach(otherT => {
                    if (otherT === t) return;
                    const otherEdges = [
                        { a: otherT.p1, b: otherT.p2 },
                        { a: otherT.p2, b: otherT.p3 },
                        { a: otherT.p3, b: otherT.p1 }
                    ];
                    otherEdges.forEach(otherEdge => {
                        if ((edge.a === otherEdge.a && edge.b === otherEdge.b) || 
                            (edge.a === otherEdge.b && edge.b === otherEdge.a)) {
                            shared = true;
                        }
                    });
                });
                
                if (!shared) {
                    polygon.push(edge);
                }
            });
        });
        
        // Remover triângulos inválidos
        triangles = triangles.filter(t => !badTriangles.includes(t));
        
        // Criar novos triângulos do ponto à fronteira da cavidade
        polygon.forEach(edge => {
            triangles.push(new Triangle(edge.a, edge.b, p));
        });
    });
    
    // 3. Remover triângulos vinculados ao super-triângulo
    triangles = triangles.filter(t => {
        return t.p1 !== p1 && t.p1 !== p2 && t.p1 !== p3 &&
               t.p2 !== p1 && t.p2 !== p2 && t.p2 !== p3 &&
               t.p3 !== p1 && t.p3 !== p2 && t.p3 !== p3;
    });
    
    return triangles;
}

// ==========================================================================
// Algoritmos de Suavização de Curvas (Stitching & Chaikin)
// ==========================================================================

// Une segmentos desconexos em linhas contínuas (polilinhas)
function stitchSegments(segments, tolerance = 1e-5) {
    const polylines = [];
    const remaining = [...segments];
    
    function pointsEqual(pt1, pt2) {
        return Math.hypot(pt1.x - pt2.x, pt1.y - pt2.y) < tolerance;
    }
    
    while (remaining.length > 0) {
        const firstSeg = remaining.shift();
        const polyline = [firstSeg.p1, firstSeg.p2];
        
        let found = true;
        while (found) {
            found = false;
            const head = polyline[0];
            const tail = polyline[polyline.length - 1];
            
            for (let i = 0; i < remaining.length; i++) {
                const seg = remaining[i];
                if (pointsEqual(seg.p1, tail)) {
                    polyline.push(seg.p2);
                    remaining.splice(i, 1);
                    found = true;
                    break;
                } else if (pointsEqual(seg.p2, tail)) {
                    polyline.push(seg.p1);
                    remaining.splice(i, 1);
                    found = true;
                    break;
                } else if (pointsEqual(seg.p1, head)) {
                    polyline.unshift(seg.p2);
                    remaining.splice(i, 1);
                    found = true;
                    break;
                } else if (pointsEqual(seg.p2, head)) {
                    polyline.unshift(seg.p1);
                    remaining.splice(i, 1);
                    found = true;
                    break;
                }
            }
            
            // Se fechou um loop completo, interrompe o crescimento desse loop
            if (polyline.length > 2 && pointsEqual(polyline[0], polyline[polyline.length - 1])) {
                break;
            }
        }
        polylines.push(polyline);
    }
    return polylines;
}

// Aplica o algoritmo de subdivisão de Chaikin para suavizar curvas
function smoothPolyline(polyline, iterations = 2) {
    if (polyline.length < 3) return polyline;
    
    const isClosed = Math.hypot(polyline[0].x - polyline[polyline.length - 1].x, polyline[0].y - polyline[polyline.length - 1].y) < 1e-5;
    
    let current = [...polyline];
    
    for (let iter = 0; iter < iterations; iter++) {
        const next = [];
        const n = current.length;
        
        if (isClosed) {
            // Curva Fechada: trata os pontos de forma cíclica
            const pts = current.slice(0, -1);
            const len = pts.length;
            for (let i = 0; i < len; i++) {
                const p0 = pts[i];
                const p1 = pts[(i + 1) % len];
                
                const q = {
                    x: 0.75 * p0.x + 0.25 * p1.x,
                    y: 0.75 * p0.y + 0.25 * p1.y
                };
                const r = {
                    x: 0.25 * p0.x + 0.75 * p1.x,
                    y: 0.25 * p0.y + 0.75 * p1.y
                };
                next.push(q, r);
            }
            // Reconecta o loop
            next.push({ ...next[0] });
        } else {
            // Curva Aberta: mantém os pontos inicial e final exatos
            next.push({ ...current[0] });
            for (let i = 0; i < n - 1; i++) {
                const p0 = current[i];
                const p1 = current[i + 1];
                
                const q = {
                    x: 0.75 * p0.x + 0.25 * p1.x,
                    y: 0.75 * p0.y + 0.25 * p1.y
                };
                const r = {
                    x: 0.25 * p0.x + 0.75 * p1.x,
                    y: 0.25 * p0.y + 0.75 * p1.y
                };
                next.push(q, r);
            }
            next.push({ ...current[n - 1] });
        }
        current = next;
    }
    return current;
}

// ==========================================================================
// Motor de Desenho Gráfico (HTML5 Canvas)
// ==========================================================================
function draw() {
    if (!canvas || !ctx) return;

    // Limpar o canvas
    ctx.fillStyle = "#0b0b10";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Listar todos os pontos conforme a aba
    let allPoints = [];
    if (activeTab === "planimetria") {
        allPoints = [startPoint, ...pointsList];
    } else {
        // Altimetria: Mescla pontos da poligonal e pontos irradiados avulsos
        allPoints = [
            { name: startPoint.name, x: startPoint.x, y: startPoint.y, z: startPoint.z, isPoligonal: true },
            ...pointsList.map(p => ({ name: p.name, x: p.x, y: p.y, z: p.z, isPoligonal: true })),
            ...altPointsList.map(p => ({ name: p.name, x: p.x, y: p.y, z: p.z, isPoligonal: false }))
        ];
    }

    if (allPoints.length === 0) return;

    // 1. Achar caixa envolvente
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    allPoints.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    let diffX = maxX - minX;
    let diffY = maxY - minY;

    if (diffX < 1e-5) diffX = 10.0;
    if (diffY < 1e-5) diffY = 10.0;

    // Padding de segurança
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
    const scale = baseScale * zoomFactor;

    // Centraliza o desenho no canvas
    const offsetX = padding + (canvas.width - 2 * padding - diffX * scale) / 2;
    const offsetY = padding + (canvas.height - 2 * padding - diffY * scale) / 2;

    // Geodésica -> Pixels da Tela
    function toScreen(x, y) {
        const sx = offsetX + (x - minX) * scale + panX;
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

    // Eixos principais
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

    // ==========================================
    // RENDERIZAÇÃO ESPECÍFICA: PLANIMETRIA
    // ==========================================
    if (activeTab === "planimetria") {
        // Desenhar as linhas de conexão da poligonal
        if (allPoints.length > 1) {
            ctx.strokeStyle = "rgba(108, 92, 231, 0.85)";
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

        // Desenhar balões de Azimute no meio de cada segmento
        ctx.font = "bold 9px 'Inter', sans-serif";
        for (let i = 1; i < allPoints.length; i++) {
            const pt1 = toScreen(allPoints[i - 1].x, allPoints[i - 1].y);
            const pt2 = toScreen(allPoints[i].x, allPoints[i].y);

            const mx = (pt1.x + pt2.x) / 2;
            const my = (pt1.y + pt2.y) / 2;

            const azStr = formatDMS(allPoints[i].calculatedAzimuth);
            const metrics = ctx.measureText(azStr);
            const textWidth = metrics.width;
            const textHeight = 10;

            // Fundo
            ctx.fillStyle = "rgba(11, 11, 16, 0.95)";
            ctx.beginPath();
            ctx.rect(mx - textWidth / 2 - 5, my - textHeight / 2 - 3, textWidth + 10, textHeight + 6);
            ctx.fill();

            // Borda
            ctx.strokeStyle = "rgba(108, 92, 231, 0.7)";
            ctx.lineWidth = 1.0;
            ctx.stroke();

            // Texto
            ctx.fillStyle = "#ffe66d";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(azStr, mx, my + 1);
        }

        // Desenhar os nós dos pontos planimétricos
        allPoints.forEach((p, idx) => {
            const pt = toScreen(p.x, p.y);

            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 6, 0, 2 * Math.PI);
            ctx.fill();

            ctx.fillStyle = (idx === 0) ? "#00d2d3" : "#ff7675";
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4.5, 0, 2 * Math.PI);
            ctx.fill();

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 12px 'Outfit', sans-serif";
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            ctx.fillText(p.name, pt.x + 10, pt.y - 4);

            ctx.fillStyle = "#9595a8";
            ctx.font = "500 9px 'Inter', sans-serif";
            ctx.textBaseline = "top";
            ctx.fillText(`X:${p.x.toFixed(1)} Y:${p.y.toFixed(1)}`, pt.x + 10, pt.y + 2);
        });
    }
    
    // ==========================================
    // RENDERIZAÇÃO ESPECÍFICA: ALTIMETRIA
    // ==========================================
    else if (activeTab === "altimetria") {
        const showTin = document.getElementById("chk-show-tin").checked;
        const showContours = document.getElementById("chk-show-contours").checked;
        const showLabels = document.getElementById("chk-show-labels").checked;

        // Triangulação TIN
        const triangles = triangulate(allPoints);

        // 1. Desenhar a malha de triangulação TIN
        if (showTin && triangles.length > 0) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
            ctx.lineWidth = 1.0;
            ctx.setLineDash([3, 3]); // Linha tracejada fina
            ctx.beginPath();
            triangles.forEach(t => {
                const s1 = toScreen(t.p1.x, t.p1.y);
                const s2 = toScreen(t.p2.x, t.p2.y);
                const s3 = toScreen(t.p3.x, t.p3.y);
                
                ctx.moveTo(s1.x, s1.y);
                ctx.lineTo(s2.x, s2.y);
                ctx.lineTo(s3.x, s3.y);
                ctx.closePath();
            });
            ctx.stroke();
            ctx.setLineDash([]); // Limpa tracejado
        }

        // 2. Interpolação e Desenho das Curvas de Nível
        if (showContours && triangles.length > 0) {
            // Achar limites verticais (Z)
            let minZ = Infinity;
            let maxZ = -Infinity;
            allPoints.forEach(p => {
                if (p.z < minZ) minZ = p.z;
                if (p.z > maxZ) maxZ = p.z;
            });

            if (minZ !== Infinity && maxZ !== -Infinity && Math.abs(maxZ - minZ) > 1e-4) {
                let equidistance = 1.0;
                let masterInterval = 5;
                try {
                    equidistance = parseDoubleRobust(document.getElementById("txt-contour-interval").value);
                    masterInterval = parseInt(document.getElementById("num-master-interval").value) || 5;
                } catch(e) {}

                // Determina as fatias de cotas inteiras que passam pelo relevo
                const startCota = Math.ceil(minZ / equidistance) * equidistance;
                const endCota = Math.floor(maxZ / equidistance) * equidistance;

                // Loop por cada fatia de altura H
                for (let h = startCota; h <= endCota; h += equidistance) {
                    const isMestra = Math.round(h / equidistance) % masterInterval === 0;

                    ctx.lineWidth = isMestra ? 1.8 : 0.8;
                    // Curvas mestras em marrom escuro, intermediárias em marrom bem claro
                    ctx.strokeStyle = isMestra ? "#a87a54" : "rgba(205, 161, 125, 0.45)";

                    // 2a. Varre todos os triângulos gerando os segmentos de reta na cota h (em coordenadas geodésicas)
                    const hSegments = [];
                    triangles.forEach(t => {
                        const pts = [t.p1, t.p2, t.p3];
                        const intersects = [];

                        // Testa as 3 arestas do triângulo: AB, BC, CA
                        for (let j = 0; j < 3; j++) {
                            const pA = pts[j];
                            const pB = pts[(j + 1) % 3];

                            // Condição robusta para evitar duplicações em vértices idênticos a h
                            if ((pA.z >= h && pB.z < h) || (pB.z >= h && pA.z < h)) {
                                // Evita divisão por zero
                                const zDiff = pB.z - pA.z;
                                if (Math.abs(zDiff) > 1e-9) {
                                    const tFactor = (h - pA.z) / zDiff;
                                    const xi = pA.x + tFactor * (pB.x - pA.x);
                                    const yi = pA.y + tFactor * (pB.y - pA.y);
                                    intersects.push({ x: xi, y: yi });
                                }
                            }
                        }

                        // Se cruza exatamente 2 arestas do triângulo, temos um segmento
                        if (intersects.length === 2) {
                            hSegments.push({ p1: intersects[0], p2: intersects[1] });
                        }
                    });

                    // 2b. Une os segmentos em linhas contínuas
                    const polylines = stitchSegments(hSegments);

                    // 2c. Suaviza as linhas usando subdivisão de Chaikin
                    const smoothedPolylines = polylines.map(line => smoothPolyline(line, 2));

                    // 2d. Desenha as linhas suavizadas no Canvas
                    smoothedPolylines.forEach(polyline => {
                        if (polyline.length < 2) return;
                        ctx.beginPath();
                        const first = toScreen(polyline[0].x, polyline[0].y);
                        ctx.moveTo(first.x, first.y);
                        for (let i = 1; i < polyline.length; i++) {
                            const pt = toScreen(polyline[i].x, polyline[i].y);
                            ctx.lineTo(pt.x, pt.y);
                        }
                        ctx.stroke();
                    });

                    // 2e. Rótulos da cota nas curvas mestras (alinhados com a curva no ponto médio)
                    if (isMestra) {
                        smoothedPolylines.forEach(polyline => {
                            if (polyline.length < 3) return; // Precisa de pontos suficientes para calcular direção e ponto médio
                            
                            // Converte pontos para pixels da tela para medir comprimento real
                            const screenPts = polyline.map(p => toScreen(p.x, p.y));
                            
                            // Calcula o comprimento total da linha na tela
                            let screenLength = 0;
                            for (let i = 0; i < screenPts.length - 1; i++) {
                                screenLength += Math.hypot(screenPts[i+1].x - screenPts[i].x, screenPts[i+1].y - screenPts[i].y);
                            }
                            
                            // Só desenha rótulo se a linha tiver um comprimento razoável na tela (evita poluição em curvas minúsculas)
                            if (screenLength > 50) {
                                const midIdx = Math.floor(screenPts.length / 2);
                                const midPt = screenPts[midIdx];
                                
                                // Determina a tangente da curva no ponto médio para alinhar o texto
                                let angle = 0;
                                if (midIdx > 0 && midIdx < screenPts.length) {
                                    const pPrev = screenPts[midIdx - 1];
                                    const pNext = screenPts[midIdx];
                                    angle = Math.atan2(pNext.y - pPrev.y, pNext.x - pPrev.x);
                                    // Normaliza o ângulo para que o texto nunca fique de cabeça para baixo (-90 a 90 graus)
                                    if (angle > Math.PI / 2) angle -= Math.PI;
                                    if (angle < -Math.PI / 2) angle += Math.PI;
                                }
                                
                                ctx.save();
                                ctx.translate(midPt.x, midPt.y);
                                ctx.rotate(angle);
                                
                                const labelText = `${h.toFixed(1)}`;
                                ctx.font = "bold 8px 'Inter', sans-serif";
                                const textWidth = ctx.measureText(labelText).width;
                                
                                // Cria um fundo opaco atrás do texto para esconder a linha da curva de nível e facilitar leitura
                                ctx.fillStyle = "#0b0b10";
                                ctx.fillRect(-textWidth/2 - 3, -5, textWidth + 6, 10);
                                
                                // Desenha o texto do rótulo
                                ctx.fillStyle = "#d2b48c"; // Tom de marrom claro/bege
                                ctx.textAlign = "center";
                                ctx.textBaseline = "middle";
                                ctx.fillText(labelText, 0, 0);
                                
                                ctx.restore();
                            }
                        });
                    }
                }
            }
        }

        // 3. Desenhar os nós de Altimetria
        allPoints.forEach(p => {
            const pt = toScreen(p.x, p.y);

            // Borda branca do ponto
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 5, 0, 2 * Math.PI);
            ctx.fill();

            // Miolo (Azul ciano para Poligonal, Coral para Cotados/Irradiados)
            ctx.fillStyle = p.isPoligonal ? "#00d2d3" : "#ff7675";
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3.5, 0, 2 * Math.PI);
            ctx.fill();

            // Nome do ponto
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 11px 'Outfit', sans-serif";
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            ctx.fillText(p.name, pt.x + 8, pt.y - 3);

            // Cota Z (exibe Z ao lado se marcado)
            if (showLabels) {
                ctx.fillStyle = p.isPoligonal ? "var(--secondary)" : "var(--warning)";
                ctx.font = "bold 9px 'Inter', sans-serif";
                ctx.textBaseline = "top";
                ctx.fillText(`Z: ${p.z.toFixed(2)}m`, pt.x + 8, pt.y + 1);
            }
        });
    }
}

// ==========================================================================
// Exportar para Arquivo CSV (Contendo Z)
// ==========================================================================
function exportToCSV() {
    if (pointsList.length === 0) {
        alert("Não há dados de poligonal para exportar.");
        return;
    }

    let csvContent = "De,Para,Distancia (m),Angulo Lido,Azimute Calculado,Delta X (m),Delta Y (m),Coord X (m),Coord Y (m),Cota Z (m)\n";
    
    // 1. Linha da Origem
    csvContent += `-,${startPoint.name},0.00,-,-,0.000,0.000,${startPoint.x.toFixed(3)},${startPoint.y.toFixed(3)},${startPoint.z.toFixed(3)}\n`;

    // 2. Pontos da Poligonal
    pointsList.forEach((p, idx) => {
        const prevX = (idx === 0) ? startPoint.x : pointsList[idx - 1].x;
        const prevY = (idx === 0) ? startPoint.y : pointsList[idx - 1].y;
        
        const dX = p.x - prevX;
        const dY = p.y - prevY;
        
        const angleLabelText = p.isAzimuth ? "Az" : "HZ";
        const inputAngleDMS = `${angleLabelText}: ${p.deg}d ${p.min}m ${p.sec.toFixed(1)}s`;
        const calcAzDMS = formatDMS(p.calculatedAzimuth).replace("°", "d").replace("'", "m").replace('"', "s");

        csvContent += `${p.fromName},${p.name},${p.distance.toFixed(2)},${inputAngleDMS},${calcAzDMS},${dX.toFixed(3)},${dY.toFixed(3)},${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}\n`;
    });

    // 3. Pontos Irradiados da Altimetria (se houverem)
    if (altPointsList.length > 0) {
        csvContent += "\n--- PONTOS IRRADIADOS / COTADOS DE ALTIMETRIA ---\n";
        csvContent += "Nome do Ponto,Coordenada X (m),Coordenada Y (m),Cota Z (m)\n";
        altPointsList.forEach(p => {
            csvContent += `${p.name},${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}\n`;
        });
    }

    // Força download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `levantamento_completo_${startPoint.name}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================================================
// Exportar para Arquivo DXF (Desenho CAD)
// ==========================================================================
function exportToDXF() {
    if (pointsList.length === 0) {
        alert("Não há dados de poligonal para exportar.");
        return;
    }

    // 1. Cabeçalho e Tabela de Camadas (Layers)
    let dxf = "  0\nSECTION\n  2\nHEADER\n  0\nENDSEC\n";
    dxf += "  0\nSECTION\n  2\nTABLES\n  0\nTABLE\n  2\nLAYER\n 70\n7\n";

    // Definição das camadas e suas cores padrão no AutoCAD
    const layers = [
        { name: "POLIGONAL_PONTOS", color: 4 },       // Ciano
        { name: "POLIGONAL_LINHAS", color: 6 },       // Magenta
        { name: "PONTOS_COTADOS", color: 1 },         // Vermelho
        { name: "TIN_MALHA", color: 9 },              // Cinza claro
        { name: "CURVAS_MESTRAS", color: 32 },        // Marrom
        { name: "CURVAS_INTERMEDIARIAS", color: 33 }, // Marrom claro
        { name: "TEXTO_COTAS", color: 2 }             // Amarelo
    ];

    layers.forEach(lyr => {
        dxf += "  0\nLAYER\n  2\n" + lyr.name + "\n 70\n0\n 62\n" + lyr.color + "\n  6\nCONTINUOUS\n";
    });

    dxf += "  0\nENDTAB\n  0\nENDSEC\n";

    // 2. Seção de Entidades
    dxf += "  0\nSECTION\n  2\nENTITIES\n";

    // Helpers locais para escrita DXF
    function writePoint(x, y, z, layer) {
        return "  0\nPOINT\n  8\n" + layer + "\n 10\n" + x.toFixed(4) + "\n 20\n" + y.toFixed(4) + "\n 30\n" + z.toFixed(4) + "\n";
    }

    function writeLine(x1, y1, z1, x2, y2, z2, layer) {
        return "  0\nLINE\n  8\n" + layer + "\n 10\n" + x1.toFixed(4) + "\n 20\n" + y1.toFixed(4) + "\n 30\n" + z1.toFixed(4) + "\n 11\n" + x2.toFixed(4) + "\n 21\n" + y2.toFixed(4) + "\n 31\n" + z2.toFixed(4) + "\n";
    }

    function writeText(x, y, z, text, height, angleDegrees, layer) {
        let str = "  0\nTEXT\n  8\n" + layer + "\n 10\n" + x.toFixed(4) + "\n 20\n" + y.toFixed(4) + "\n 30\n" + z.toFixed(4) + "\n 40\n" + height.toFixed(2) + "\n  1\n" + text + "\n";
        if (angleDegrees !== 0) {
            str += " 50\n" + angleDegrees.toFixed(2) + "\n";
        }
        return str;
    }

    function write3DFace(p1, p2, p3, layer) {
        // Para triângulos no formato 3DFACE, o 4º vértice deve ser idêntico ao 3º
        return "  0\n3DFACE\n  8\n" + layer +
               "\n 10\n" + p1.x.toFixed(4) + "\n 20\n" + p1.y.toFixed(4) + "\n 30\n" + (p1.z || 0.0).toFixed(4) +
               "\n 11\n" + p2.x.toFixed(4) + "\n 21\n" + p2.y.toFixed(4) + "\n 31\n" + (p2.z || 0.0).toFixed(4) +
               "\n 12\n" + p3.x.toFixed(4) + "\n 22\n" + p3.y.toFixed(4) + "\n 32\n" + (p3.z || 0.0).toFixed(4) +
               "\n 13\n" + p3.x.toFixed(4) + "\n 23\n" + p3.y.toFixed(4) + "\n 33\n" + (p3.z || 0.0).toFixed(4) + "\n";
    }

    function write3DPolyline(points, zVal, layer) {
        if (points.length < 2) return "";
        // 70\n8 indica que a POLYLINE é uma polilinha 3D
        let str = "  0\nPOLYLINE\n  8\n" + layer + "\n 66\n1\n 70\n8\n 10\n0.0\n 20\n0.0\n 30\n0.0\n";
        points.forEach(p => {
            // 70\n32 indica vértice de malha/polilinha 3D
            str += "  0\nVERTEX\n  8\n" + layer + "\n 70\n32\n 10\n" + p.x.toFixed(4) + "\n 20\n" + p.y.toFixed(4) + "\n 30\n" + zVal.toFixed(4) + "\n";
        });
        str += "  0\nSEQEND\n  8\n" + layer + "\n";
        return str;
    }

    // 3. Exportar Poligonal (Planimetria)
    // 3a. Pontos e rótulos da poligonal
    dxf += writePoint(startPoint.x, startPoint.y, startPoint.z, "POLIGONAL_PONTOS");
    dxf += writeText(startPoint.x + 0.8, startPoint.y + 0.8, startPoint.z, startPoint.name, 1.2, 0, "POLIGONAL_PONTOS");
    dxf += writeText(startPoint.x + 0.8, startPoint.y - 0.8, startPoint.z, `Z: ${startPoint.z.toFixed(2)}m`, 0.8, 0, "TEXTO_COTAS");

    pointsList.forEach((p, idx) => {
        dxf += writePoint(p.x, p.y, p.z, "POLIGONAL_PONTOS");
        dxf += writeText(p.x + 0.8, p.y + 0.8, p.z, p.name, 1.2, 0, "POLIGONAL_PONTOS");
        dxf += writeText(p.x + 0.8, p.y - 0.8, p.z, `Z: ${p.z.toFixed(2)}m`, 0.8, 0, "TEXTO_COTAS");

        // 3b. Linhas de conexão
        const prev = (idx === 0) ? startPoint : pointsList[idx - 1];
        dxf += writeLine(prev.x, prev.y, prev.z, p.x, p.y, p.z, "POLIGONAL_LINHAS");
    });

    // 4. Exportar Altimetria (se houver dados)
    // Mescla pontos para processamento do TIN e Curvas de Nível
    const allPoints = [
        { name: startPoint.name, x: startPoint.x, y: startPoint.y, z: startPoint.z, isPoligonal: true },
        ...pointsList.map(p => ({ name: p.name, x: p.x, y: p.y, z: p.z, isPoligonal: true })),
        ...altPointsList.map(p => ({ name: p.name, x: p.x, y: p.y, z: p.z, isPoligonal: false }))
    ];

    // 4a. Pontos irradiados/cotados avulsos
    altPointsList.forEach(p => {
        dxf += writePoint(p.x, p.y, p.z, "PONTOS_COTADOS");
        dxf += writeText(p.x + 0.8, p.y + 0.8, p.z, p.name, 1.0, 0, "PONTOS_COTADOS");
        dxf += writeText(p.x + 0.8, p.y - 0.8, p.z, `Z: ${p.z.toFixed(2)}m`, 0.8, 0, "TEXTO_COTAS");
    });

    // Se temos pontos suficientes para gerar relevo
    if (allPoints.length >= 3) {
        const triangles = triangulate(allPoints);

        // 4b. Exportar Malha TIN (3DFACEs)
        triangles.forEach(t => {
            dxf += write3DFace(t.p1, t.p2, t.p3, "TIN_MALHA");
        });

        // 4c. Exportar Curvas de Nível (fatiamento, junção e suavização)
        let minZ = Infinity;
        let maxZ = -Infinity;
        allPoints.forEach(p => {
            if (p.z < minZ) minZ = p.z;
            if (p.z > maxZ) maxZ = p.z;
        });

        if (minZ !== Infinity && maxZ !== -Infinity && Math.abs(maxZ - minZ) > 1e-4) {
            let equidistance = 1.0;
            let masterInterval = 5;
            try {
                equidistance = parseDoubleRobust(document.getElementById("txt-contour-interval").value);
                masterInterval = parseInt(document.getElementById("num-master-interval").value) || 5;
            } catch(e) {}

            const startCota = Math.ceil(minZ / equidistance) * equidistance;
            const endCota = Math.floor(maxZ / equidistance) * equidistance;

            for (let h = startCota; h <= endCota; h += equidistance) {
                const isMestra = Math.round(h / equidistance) % masterInterval === 0;
                const layer = isMestra ? "CURVAS_MESTRAS" : "CURVAS_INTERMEDIARIAS";

                const hSegments = [];
                triangles.forEach(t => {
                    const pts = [t.p1, t.p2, t.p3];
                    const intersects = [];

                    for (let j = 0; j < 3; j++) {
                        const pA = pts[j];
                        const pB = pts[(j + 1) % 3];

                        if ((pA.z >= h && pB.z < h) || (pB.z >= h && pA.z < h)) {
                            const zDiff = pB.z - pA.z;
                            if (Math.abs(zDiff) > 1e-9) {
                                const tFactor = (h - pA.z) / zDiff;
                                const xi = pA.x + tFactor * (pB.x - pA.x);
                                const yi = pA.y + tFactor * (pB.y - pA.y);
                                intersects.push({ x: xi, y: yi });
                            }
                        }
                    }

                    if (intersects.length === 2) {
                        hSegments.push({ p1: intersects[0], p2: intersects[1] });
                    }
                });

                const polylines = stitchSegments(hSegments);
                const smoothedPolylines = polylines.map(line => smoothPolyline(line, 2));

                // Escrever polilinhas 3D no DXF
                smoothedPolylines.forEach(polyline => {
                    if (polyline.length < 2) return;
                    dxf += write3DPolyline(polyline, h, layer);

                    // Adicionar rótulo de cota rotacionado nas curvas mestras
                    if (isMestra && polyline.length >= 3) {
                        const midIdx = Math.floor(polyline.length / 2);
                        const midPt = polyline[midIdx];
                        
                        let angleDegrees = 0;
                        if (midIdx > 0 && midIdx < polyline.length) {
                            const pPrev = polyline[midIdx - 1];
                            const pNext = polyline[midIdx];
                            // Calcula ângulo no plano geodésico
                            const angleRad = Math.atan2(pNext.y - pPrev.y, pNext.x - pPrev.x);
                            angleDegrees = angleRad * (180.0 / Math.PI);
                            
                            // Ajusta para que o texto nunca fique invertido (-90 a 90 graus)
                            if (angleDegrees > 90) angleDegrees -= 180;
                            if (angleDegrees < -90) angleDegrees += 180;
                        }

                        // Altura do texto proporcional
                        dxf += writeText(midPt.x, midPt.y, h, h.toFixed(1), 1.0, angleDegrees, "TEXTO_COTAS");
                    }
                });
            }
        }
    }

    // Fechar Seção de Entidades e Arquivo
    dxf += "  0\nENDSEC\n  0\nEOF\n";

    // Forçar download do arquivo .dxf
    const blob = new Blob([dxf], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `levantamento_${startPoint.name}.dxf`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
