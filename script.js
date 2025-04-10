document.addEventListener('DOMContentLoaded', function() {
    const jsPlumbInstance = jsPlumb.getInstance({
        Connector: ['Flowchart', { cornerRadius: 5, stub: 30, gap: 10 }],
        Anchors: ['Right', 'Left'],
        Endpoint: ['Dot', { radius: 2 }],
        EndpointStyle: { fill: '#3b82f6' },
        PaintStyle: { 
            stroke: '#3b82f6', 
            strokeWidth: 2 
        },
        Overlays: [
            ['Arrow', { 
                location: 1, 
                width: 10, 
                length: 10, 
                foldback: 0.8 
            }]
        ],
        ConnectionsDetachable: false
    });

    const diagramContainer = document.getElementById('diagramContainer');
    const sidePanel = document.getElementById('sidePanel');
    const processForm = document.getElementById('processForm');
    const panelTitle = document.getElementById('panelTitle');
    const cancelBtn = document.getElementById('cancelBtn');
    const closePanelBtn = document.getElementById('closePanelBtn');
    const contextMenu = document.getElementById('contextMenu');
    const copyNodeBtn = document.getElementById('copyNode');
    const duplicateNodeBtn = document.getElementById('duplicateNode');
    const deleteNodeBtn = document.getElementById('deleteNode');
    const helpLinkBtn = document.getElementById('helpLink');
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const zoomLevelEl = document.getElementById('zoomLevel');

    let processes = [
        {
            id: '1',
            url: 'index',
            title: '始める',
            keywords: '',
            description: '',
            position: { x: 100, y: 150 }
        }
    ];
    
    let selectedProcessId = null;
    let afterProcessId = null;
    let isDragging = false;
    let clickTime = 0;
    let clickThreshold = 200; // milisegundos para distinguir entre clic y arrastre
    let contextMenuProcessId = null;
    let clipboardData = null;
    let zoomLevel = 1; // 1 = 100%
    
    // Variables para navegación panorámica
    let isPanning = false;
    let startX, startY, startScrollLeft, startScrollTop;

    function renderProcesses() {
        diagramContainer.innerHTML = '';
        jsPlumbInstance.reset();
        
        processes.forEach(process => {
            createProcessNode(process);
        });
        
        // Esperar a que los nodos se rendericen antes de crear las conexiones
        setTimeout(() => {
            // Crear conexiones entre procesos
            for (let i = 0; i < processes.length - 1; i++) {
                jsPlumbInstance.connect({
                    source: `process-${processes[i].id}`,
                    target: `process-${processes[i+1].id}`
                });
            }
            
            // Hacer los nodos arrastrables
            jsPlumbInstance.draggable(document.querySelectorAll('.process-node'), {
                containment: 'parent',
                grid: [10, 10],
                start: () => { 
                    isDragging = true;
                    clickTime = Date.now();
                },
                stop: (event) => {
                    // Solo considerar como arrastre si ha pasado suficiente tiempo
                    if (Date.now() - clickTime > clickThreshold) {
                        // Actualizar la posición del proceso
                        const processId = event.el.getAttribute('data-id');
                        const process = processes.find(p => p.id === processId);
                        if (process) {
                            process.position = {
                                x: parseInt(event.el.style.left),
                                y: parseInt(event.el.style.top)
                            };
                        }
                        
                        // Repintar las conexiones
                        jsPlumbInstance.repaintEverything();
                    }
                    
                    // Retrasar el reseteo de isDragging para evitar que se active el clic
                    setTimeout(() => {
                        isDragging = false;
                    }, 50);
                }
            });
        }, 100);
    }

    // Crear un nodo de proceso
    function createProcessNode(process) {
        const node = document.createElement('div');
        node.id = `process-${process.id}`;
        node.className = 'process-node';
        node.setAttribute('data-id', process.id);
        node.style.left = `${process.position.x}px`;
        node.style.top = `${process.position.y}px`;
        
        node.innerHTML = `
            <div class="process-title">${process.title}</div>
            <button class="add-after-btn" data-id="${process.id}">
                <i class="fas fa-plus"></i>
            </button>
        `;
        
        // Agregar evento de clic para editar
        node.addEventListener('click', (e) => {
            if (!isDragging && !e.target.closest('.add-after-btn')) {
                openSidePanel(process.id);
            }
        });
        
        // Agregar evento de clic derecho para mostrar menú contextual
        node.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            contextMenuProcessId = process.id;
            showContextMenu(e.clientX, e.clientY);
        });
        
        diagramContainer.appendChild(node);
        
        // Agregar evento al botón de añadir después
        const addAfterBtn = node.querySelector('.add-after-btn');
        addAfterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            afterProcessId = process.id;
            openSidePanel();
        });
    }

    // Mostrar menú contextual
    function showContextMenu(x, y) {
        // Posicionar el menú
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.style.display = 'block';
        
        // Actualizar el enlace de ayuda con la URL del proceso
        const process = processes.find(p => p.id === contextMenuProcessId);
        if (process) {
            helpLinkBtn.setAttribute('data-url', process.url);
        }
        
        // Cerrar el menú al hacer clic fuera de él
        document.addEventListener('click', hideContextMenu);
    }

    // Ocultar menú contextual
    function hideContextMenu() {
        contextMenu.style.display = 'none';
        document.removeEventListener('click', hideContextMenu);
    }

    // Abrir panel lateral para crear/editar proceso
    function openSidePanel(processId = null) {
        selectedProcessId = processId;
        
        if (processId) {
            // Editar proceso existente
            const process = processes.find(p => p.id === processId);
            if (process) {
                panelTitle.textContent = '';
                document.getElementById('url').value = process.url;
                document.getElementById('title').value = process.title;
                document.getElementById('keywords').value = process.keywords;
                document.getElementById('description').value = process.description;
            }
            afterProcessId = null;
        } else {
            // Crear nuevo proceso
            processForm.reset();
            panelTitle.textContent = 'new';
            document.getElementById('url').value = 'index';
            document.getElementById('title').value = 'タイトル';
        }
        
        sidePanel.classList.add('open');
    }

    // Cerrar panel lateral
    function closeSidePanel() {
        sidePanel.classList.remove('open');
        selectedProcessId = null;
        afterProcessId = null;
    }

    // Guardar proceso
    function saveProcess(formData) {
        if (selectedProcessId) {
            // Actualizar proceso existente
            const processIndex = processes.findIndex(p => p.id === selectedProcessId);
            if (processIndex !== -1) {
                processes[processIndex] = {
                    ...processes[processIndex],
                    url: formData.url,
                    title: formData.title,
                    keywords: formData.keywords,
                    description: formData.description
                };
            }
        } else if (afterProcessId) {
            // Insertar después de un proceso específico
            const afterIndex = processes.findIndex(p => p.id === afterProcessId);
            if (afterIndex !== -1) {
                const afterProcess = processes[afterIndex];
                const newId = Date.now().toString();
                
                // Calcular nueva posición (a la derecha del proceso seleccionado)
                const newX = afterProcess.position.x + 300;
                const newY = afterProcess.position.y;
                
                const newProcess = {
                    id: newId,
                    url: formData.url,
                    title: formData.title,
                    keywords: formData.keywords,
                    description: formData.description,
                    position: { x: newX, y: newY }
                };
                
                // Desplazar los procesos que están después
                for (let i = afterIndex + 1; i < processes.length; i++) {
                    processes[i].position.x += 300;
                }
                
                // Insertar el nuevo proceso después del seleccionado
                processes.splice(afterIndex + 1, 0, newProcess);
            }
        } else {
            // Crear nuevo proceso al final
            const newId = Date.now().toString();
            let newX = 100;
            let newY = 150;
            
            if (processes.length > 0) {
                const lastProcess = processes[processes.length - 1];
                newX = lastProcess.position.x + 300;
                newY = lastProcess.position.y;
            }
            
            const newProcess = {
                id: newId,
                url: formData.url,
                title: formData.title,
                keywords: formData.keywords,
                description: formData.description,
                position: { x: newX, y: newY }
            };
            
            processes.push(newProcess);
        }
        
        // Actualizar diagrama
        renderProcesses();
        closeSidePanel();
    }

    // Copiar nodo
    function copyNode() {
        const process = processes.find(p => p.id === contextMenuProcessId);
        if (process) {
            // Guardar en el portapapeles interno
            clipboardData = {
                url: process.url,
                title: process.title,
                keywords: process.keywords,
                description: process.description
            };
            
            // Intentar copiar al portapapeles del sistema
            const processData = JSON.stringify(clipboardData);
            navigator.clipboard.writeText(processData)
                .then(() => {
                    console.log('Proceso copiado al portapapeles');
                })
                .catch(err => {
                    console.error('Error al copiar: ', err);
                });
        }
        hideContextMenu();
    }

    // Pegar nodo
    function pasteNode() {
        if (clipboardData) {
            const newId = Date.now().toString();
            let newX = 100;
            let newY = 150;
            
            if (processes.length > 0) {
                const lastProcess = processes[processes.length - 1];
                newX = lastProcess.position.x + 50;
                newY = lastProcess.position.y + 50;
            }
            
            const newProcess = {
                id: newId,
                ...clipboardData,
                position: { x: newX, y: newY }
            };
            
            processes.push(newProcess);
            renderProcesses();
        }
    }

    // Duplicar nodo
    function duplicateNode() {
        const process = processes.find(p => p.id === contextMenuProcessId);
        if (process) {
            const newId = Date.now().toString();
            const newProcess = {
                id: newId,
                url: process.url,
                title: process.title,
                keywords: process.keywords,
                description: process.description,
                position: { 
                    x: process.position.x + 50, 
                    y: process.position.y + 50 
                }
            };
            
            processes.push(newProcess);
            renderProcesses();
        }
        hideContextMenu();
    }

    // Eliminar nodo
    function deleteNode() {
        if (!contextMenuProcessId && selectedProcessId) {
            contextMenuProcessId = selectedProcessId;
        }
        
        if (contextMenuProcessId) {
            const processIndex = processes.findIndex(p => p.id === contextMenuProcessId);
            if (processIndex !== -1) {
                processes.splice(processIndex, 1);
                renderProcesses();
                if (sidePanel.classList.contains('open')) {
                    closeSidePanel();
                }
            }
        }
        hideContextMenu();
    }

    // Abrir enlace de ayuda
    function openHelpLink() {
        const process = processes.find(p => p.id === contextMenuProcessId);
        if (process && process.url) {
            window.open(process.url, '_blank');
        }
        hideContextMenu();
    }

    // Aplicar zoom
    function applyZoom() {
        diagramContainer.style.transformOrigin = '0 0';
        diagramContainer.style.transform = `scale(${zoomLevel})`;
        zoomLevelEl.textContent = `${Math.round(zoomLevel * 100)}%`;
        jsPlumbInstance.setZoom(zoomLevel);
    }

    // Aumentar zoom
    function zoomIn() {
        if (zoomLevel < 2) {
            zoomLevel += 0.1;
            applyZoom();
        }
    }

    // Disminuir zoom
    function zoomOut() {
        if (zoomLevel > 0.5) {
            zoomLevel -= 0.1;
            applyZoom();
        }
    }

    // Event Listeners
    cancelBtn.addEventListener('click', closeSidePanel);
    closePanelBtn.addEventListener('click', closeSidePanel);
    
    processForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = {
            url: document.getElementById('url').value,
            title: document.getElementById('title').value,
            keywords: document.getElementById('keywords').value,
            description: document.getElementById('description').value
        };
        
        saveProcess(formData);
    });

    // Event listeners para el menú contextual
    copyNodeBtn.addEventListener('click', copyNode);
    duplicateNodeBtn.addEventListener('click', duplicateNode);
    deleteNodeBtn.addEventListener('click', deleteNode);
    helpLinkBtn.addEventListener('click', openHelpLink);

    // Event listeners para zoom
    zoomInBtn.addEventListener('click', zoomIn);
    zoomOutBtn.addEventListener('click', zoomOut);

    // Cerrar el menú contextual al hacer clic en cualquier parte
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
        }
    });

    // Prevenir que se abra el menú contextual del navegador en el contenedor
    diagramContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Manejar atajos de teclado
    document.addEventListener('keydown', (e) => {
        // Tecla Delete para eliminar nodo
        if (e.key === 'Delete') {
            if (selectedProcessId || contextMenuProcessId) {
                deleteNode();
            }
        }
        
        // Ctrl+C para copiar
        if (e.ctrlKey && e.key === 'c') {
            if (selectedProcessId || contextMenuProcessId) {
                if (!contextMenuProcessId) contextMenuProcessId = selectedProcessId;
                copyNode();
            }
        }
        
        // Ctrl+V para pegar
        if (e.ctrlKey && e.key === 'v') {
            pasteNode();
        }
        
        // Ctrl+D para duplicar
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault(); // Prevenir el comportamiento por defecto del navegador
            if (selectedProcessId || contextMenuProcessId) {
                if (!contextMenuProcessId) contextMenuProcessId = selectedProcessId;
                duplicateNode();
            }
        }
    });

    // Inicializar el diagrama
    renderProcesses();

    // Configurar la navegación panorámica (PAN)
    diagramContainer.addEventListener('mousedown', (e) => {
        // Solo activar navegación panorámica con clic primario y si no se hace clic en un nodo
        if (e.button === 0 && !e.target.closest('.process-node') && !e.target.closest('.add-after-btn')) {
            isPanning = true;
            diagramContainer.style.cursor = 'grabbing';
            
            // Guardar posición inicial
            startX = e.clientX;
            startY = e.clientY;
            startScrollLeft = diagramContainer.scrollLeft;
            startScrollTop = diagramContainer.scrollTop;
            
            e.preventDefault();
        }
    });

    // Manejar el movimiento del mouse para la navegación panorámica
    document.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        diagramContainer.scrollLeft = startScrollLeft - dx;
        diagramContainer.scrollTop = startScrollTop - dy;
    });

    // Detener la navegación panorámica
    document.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            diagramContainer.style.cursor = 'default';
        }
    });

    // Configuración del zoom con la rueda del mouse
    diagramContainer.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            // Zoom con Ctrl + rueda
            e.preventDefault();
            
            // Calcular el punto de referencia para el zoom (posición del cursor)
            const rect = diagramContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Posición actual del scroll
            const startScrollLeft = diagramContainer.scrollLeft;
            const startScrollTop = diagramContainer.scrollTop;
            
            // Posición relativa del cursor dentro del contenedor de desplazamiento
            const mouseXRatio = (mouseX + startScrollLeft) / (diagramContainer.scrollWidth * zoomLevel);
            const mouseYRatio = (mouseY + startScrollTop) / (diagramContainer.scrollHeight * zoomLevel);
            
            // Factor de zoom ajustable
            const oldZoom = zoomLevel;
            
            // Ajustar nivel de zoom según la dirección de la rueda
            if (e.deltaY < 0) {
                // Zoom in
                if (zoomLevel < 2) {
                    zoomLevel += 0.1;
                }
            } else {
                // Zoom out
                if (zoomLevel > 0.5) {
                    zoomLevel -= 0.1;
                }
            }
            
            // Solo aplicar si el zoom cambió
            if (oldZoom !== zoomLevel) {
                // Aplicar zoom
                applyZoom();
                
                // Ajustar el scroll para mantener el punto de referencia
                setTimeout(() => {
                    const newScrollLeft = mouseXRatio * diagramContainer.scrollWidth * zoomLevel - mouseX;
                    const newScrollTop = mouseYRatio * diagramContainer.scrollHeight * zoomLevel - mouseY;
                    diagramContainer.scrollLeft = newScrollLeft;
                    diagramContainer.scrollTop = newScrollTop;
                }, 10);
            }
        }
    });

    // Manejar el redimensionamiento de la ventana
    window.addEventListener('resize', () => {
        jsPlumbInstance.repaintEverything();
    });
});