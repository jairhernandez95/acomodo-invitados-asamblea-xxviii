let persons = [];
let tables = {};
let fileData = null; // Guardar los datos del archivo para auto-asignación

function initializeTables() {
    tables['Mesa Principal'] = [];
    for (let i = 1; i <= 18; i++) {
        tables[`Mesa ${i}`] = [];
    }
    renderTables();
}

function renderPersonList() {
    const list = document.getElementById('personList');
    const unassigned = persons.filter(p => !isPersonAssigned(p.nombre));
    
    list.innerHTML = unassigned.map(person => {
        const escapedName = person.nombre.replace(/'/g, "\\'");
        const attendClass = person.asiste ? 'attending' : 'not-attending';
        const attendIcon = person.asiste ? '✓' : '✗';
        
        return `
            <div class="person-item ${attendClass}" draggable="true" ondragstart="dragStart(event, '${escapedName}')" data-person="${person.nombre}">
                <div class="person-info">
                    <span class="person-name">${person.nombre}</span>
                    <span class="attend-badge">${attendIcon}</span>
                </div>
                <button class="delete-person" onclick="deletePerson('${escapedName}')">✕</button>
            </div>
        `;
    }).join('');
    
    updateStats();
}

function renderTables() {
    const grid = document.getElementById('tablesGrid');
    const tableOrder = ['Mesa Principal', ...Array.from({length: 18}, (_, i) => `Mesa ${i + 1}`)];
    
    grid.innerHTML = tableOrder.map(tableName => {
        const isMain = tableName === 'Mesa Principal';
        const assignedPersons = tables[tableName] || [];
        const attendingCount = assignedPersons.filter(p => {
            const personObj = persons.find(per => per.nombre === p);
            return personObj && personObj.asiste;
        }).length;
        
        return `
            <div class="table-card ${isMain ? 'main-table' : ''}" 
                 ondrop="drop(event, '${tableName}')" 
                 ondragover="allowDrop(event)"
                 ondragenter="dragEnter(event)"
                 ondragleave="dragLeave(event)">
                <div class="table-header">
                    <span class="table-name">${isMain ? '👑 ' : ''}${tableName}</span>
                    <div class="table-stats">
                        <span class="table-count">${assignedPersons.length}</span>
                        <span class="table-attending">${attendingCount} ✓</span>
                    </div>
                </div>
                <div class="table-persons">
                    ${assignedPersons.map(personName => {
                        const escapedName = personName.replace(/'/g, "\\'");
                        const personObj = persons.find(p => p.nombre === personName);
                        const attendClass = personObj && personObj.asiste ? 'attending' : 'not-attending';
                        const attendIcon = personObj && personObj.asiste ? '✓' : '✗';
                        
                        return `
                            <div class="assigned-person ${attendClass}" draggable="true" ondragstart="dragStartAssigned(event, '${escapedName}', '${tableName}')">
                                <div class="person-info">
                                    <span class="person-name">${personName}</span>
                                    <span class="attend-badge">${attendIcon}</span>
                                </div>
                                <button class="remove-btn" onclick="removeFromTable('${escapedName}', '${tableName}')">✕</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
    
    updateStats();
}

function addPerson() {
    const input = document.getElementById('newPersonName');
    const name = input.value.trim();
    
    if (name && !persons.find(p => p.nombre === name)) {
        persons.push({ nombre: name, asiste: true });
        input.value = '';
        renderPersonList();
    }
}

function deletePerson(personName) {
    persons = persons.filter(p => p.nombre !== personName);
    renderPersonList();
}

function isPersonAssigned(personName) {
    return Object.values(tables).some(table => table.includes(personName));
}

function dragStart(e, personName) {
    e.dataTransfer.setData('person', personName);
    e.dataTransfer.setData('fromTable', '');
    e.target.classList.add('dragging');
}

function dragStartAssigned(e, personName, fromTable) {
    e.dataTransfer.setData('person', personName);
    e.dataTransfer.setData('fromTable', fromTable);
    e.target.classList.add('dragging');
}

function allowDrop(e) {
    e.preventDefault();
}

function dragEnter(e) {
    if (e.target.classList.contains('table-card')) {
        e.target.classList.add('drag-over');
    }
}

function dragLeave(e) {
    if (e.target.classList.contains('table-card')) {
        e.target.classList.remove('drag-over');
    }
}

function drop(e, toTable) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const personName = e.dataTransfer.getData('person');
    const fromTable = e.dataTransfer.getData('fromTable');
    
    if (fromTable) {
        tables[fromTable] = tables[fromTable].filter(p => p !== personName);
    }
    
    if (!tables[toTable].includes(personName)) {
        tables[toTable].push(personName);
    }
    
    renderTables();
    renderPersonList();
}

function removeFromTable(personName, tableName) {
    tables[tableName] = tables[tableName].filter(p => p !== personName);
    renderTables();
    renderPersonList();
}

function updateStats() {
    const assigned = Object.values(tables).flat().length;
    const attending = persons.filter(p => p.asiste).length;
    const notAttending = persons.filter(p => !p.asiste).length;
    
    document.getElementById('totalPersons').textContent = persons.length;
    document.getElementById('assignedPersons').textContent = assigned;
    document.getElementById('unassignedPersons').textContent = persons.length - assigned;
    document.getElementById('attendingPersons').textContent = attending;
    document.getElementById('notAttendingPersons').textContent = notAttending;
}

function clearAllTables() {
    if (confirm('¿Estás seguro de que quieres limpiar todas las asignaciones?')) {
        Object.keys(tables).forEach(table => {
            tables[table] = [];
        });
        renderTables();
        renderPersonList();
    }
}

// Función para auto-asignar desde el archivo Excel
function autoAssignFromFile() {
    if (!fileData) {
        alert('❌ No hay archivo cargado. Por favor carga un archivo Excel/CSV primero.');
        return;
    }

    console.log('\n⚡ === INICIANDO AUTO-ASIGNACIÓN ===');
    
    // Limpiar todas las mesas antes de asignar
    Object.keys(tables).forEach(table => {
        tables[table] = [];
    });

    let assignedCount = 0;
    let notFoundTables = new Map();
    let notFoundPersons = [];
    let mesasEncontradas = new Set();

    // Procesar cada fila del archivo
    fileData.forEach((row, index) => {
        const nombre = (
            row['Nombre'] || 
            row['nombre'] || 
            row['NOMBRE'] ||
            row['Name'] ||
            row['name'] ||
            row['NAME']
        );
        
        const mesaExcel = (
            row['Mesa'] || 
            row['mesa'] || 
            row['MESA'] ||
            row['Table'] || 
            row['table'] ||
            row['TABLE']
        );

        if (nombre && String(nombre).trim() !== '') {
            const nombreTrimmed = String(nombre).trim();
            
            // Verificar que la persona existe en nuestra lista
            const personExists = persons.find(p => p.nombre === nombreTrimmed);
            
            if (!personExists) {
                notFoundPersons.push(nombreTrimmed);
                console.warn(`  ⚠️ Persona "${nombreTrimmed}" no está en la lista cargada`);
                return;
            }
            
            // Asignar a mesa si existe
            if (mesaExcel && String(mesaExcel).trim() !== '') {
                const mesaExcelTrimmed = String(mesaExcel).trim();
                
                // CONVERTIR el formato de Excel al formato del sistema
                let mesaSistema;
                
                if (mesaExcelTrimmed.toLowerCase() === 'principal') {
                    mesaSistema = 'Mesa Principal';
                } else {
                    // Si es un número, agregar "Mesa " adelante
                    const numero = parseInt(mesaExcelTrimmed);
                    if (!isNaN(numero) && numero >= 1 && numero <= 18) {
                        mesaSistema = `Mesa ${numero}`;
                    } else {
                        mesaSistema = null;
                    }
                }
                
                // Verificar que la mesa existe
                if (mesaSistema && tables.hasOwnProperty(mesaSistema)) {
                    // Agregar persona a la mesa
                    if (!tables[mesaSistema].includes(nombreTrimmed)) {
                        tables[mesaSistema].push(nombreTrimmed);
                        assignedCount++;
                        mesasEncontradas.add(mesaSistema);
                        console.log(`  ✅ "${nombreTrimmed}" [Excel: "${mesaExcelTrimmed}"] → "${mesaSistema}"`);
                    }
                } else {
                    // Contar cuántas veces aparece cada mesa no encontrada
                    if (notFoundTables.has(mesaExcelTrimmed)) {
                        notFoundTables.set(mesaExcelTrimmed, notFoundTables.get(mesaExcelTrimmed) + 1);
                    } else {
                        notFoundTables.set(mesaExcelTrimmed, 1);
                    }
                    console.warn(`  ⚠️ Mesa "${mesaExcelTrimmed}" no se pudo convertir (Persona: "${nombreTrimmed}")`);
                }
            } else {
                console.log(`  ℹ️ "${nombreTrimmed}" no tiene mesa asignada en el archivo`);
            }
        }
    });

    console.log('\n📊 === RESUMEN DE AUTO-ASIGNACIÓN ===');
    console.log(`✅ Personas asignadas: ${assignedCount}`);
    console.log(`🏠 Mesas utilizadas: ${mesasEncontradas.size}`);
    
    if (notFoundTables.size > 0) {
        console.log('\n⚠️ === MESAS DEL ARCHIVO NO CONVERTIDAS ===');
        console.log('Estas mesas están en tu Excel pero no se pudieron convertir:');
        notFoundTables.forEach((count, mesa) => {
            console.log(`  ❌ "${mesa}" (${count} persona(s))`);
        });
        
        console.log('\n💡 === FORMATO ESPERADO EN EXCEL ===');
        console.log('Tu columna "Mesa" debe contener:');
        console.log('  ✓ "Principal" (para Mesa Principal)');
        console.log('  ✓ 1, 2, 3, ... 18 (números del 1 al 18)');
    }
    
    if (notFoundPersons.length > 0) {
        console.log('\n⚠️ Personas no encontradas en la lista cargada:');
        notFoundPersons.forEach(persona => console.log(`  ❌ "${persona}"`));
    }
    
    console.log('\n🏠 === DISTRIBUCIÓN FINAL ===');
    Object.entries(tables).forEach(([mesa, personas]) => {
        if (personas.length > 0) {
            console.log(`  ${mesa}: ${personas.length} persona(s)`);
            personas.forEach(p => console.log(`    - ${p}`));
        }
    });

    // Renderizar la interfaz actualizada
    renderTables();
    renderPersonList();

    // Mensaje al usuario
    let mensaje = `✅ Auto-asignación completada!\n\n📊 Resultado:\n- Personas asignadas: ${assignedCount}\n- Sin asignar: ${persons.length - assignedCount}`;
    
    if (notFoundTables.size > 0) {
        mensaje += `\n\n⚠️ ATENCIÓN: ${notFoundTables.size} valor(es) de mesa no se pudieron convertir.\n\n`;
        mensaje += `Valores NO reconocidos:\n`;
        notFoundTables.forEach((count, mesa) => {
            mensaje += `- "${mesa}" (${count} personas)\n`;
        });
        mensaje += `\n💡 Usa "Principal" o números del 1 al 18`;
    }
    
    alert(mensaje);
}

// Manejo de archivos
document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    console.log('📁 Archivo seleccionado:', file.name);

    const reader = new FileReader();
    const extension = file.name.split('.').pop().toLowerCase();

    reader.onload = function(e) {
        try {
            if (extension === 'csv') {
                const text = e.target.result;
                console.log('📄 Parseando archivo CSV...');
                Papa.parse(text, {
                    header: true,
                    skipEmptyLines: true,
                    dynamicTyping: false,
                    transformHeader: function(header) {
                        // Limpiar headers (eliminar espacios y normalizar)
                        return header.trim();
                    },
                    complete: function(results) {
                        console.log('✅ CSV parseado correctamente');
                        console.log('Headers encontrados:', results.meta.fields);
                        console.log('Total de filas:', results.data.length);
                        loadData(results.data);
                    },
                    error: function(error) {
                        alert('Error al parsear CSV: ' + error.message);
                    }
                });
            } else {
                console.log('📄 Leyendo archivo Excel...');
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                console.log('✅ Excel leído correctamente');
                console.log('Hoja:', workbook.SheetNames[0]);
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
                    raw: false,
                    defval: '',
                    blankrows: false
                });
                console.log('Total de filas:', jsonData.length);
                if (jsonData.length > 0) {
                    console.log('Columnas encontradas:', Object.keys(jsonData[0]));
                }
                loadData(jsonData);
            }
        } catch (error) {
            alert('Error al leer el archivo: ' + error.message);
            console.error('❌ Error completo:', error);
        }
    };

    if (extension === 'csv') {
        reader.readAsText(file, 'UTF-8');
    } else {
        reader.readAsArrayBuffer(file);
    }
    
    e.target.value = '';
});

function loadData(data) {
    console.log('\n🔄 === CARGANDO ARCHIVO ===');
    
    // Guardar los datos del archivo para auto-asignación posterior
    fileData = data;
    
    // Habilitar el botón de auto-asignar
    document.getElementById('autoAssignBtn').disabled = false;
    
    // Limpiar todos los datos existentes
    persons = [];
    Object.keys(tables).forEach(table => {
        tables[table] = [];
    });

    console.log('📋 Total de filas a procesar:', data.length);
    
    // Mostrar ejemplo de la primera fila para debug
    if (data.length > 0) {
        console.log('📝 Ejemplo de fila 1:', data[0]);
        console.log('📝 Columnas detectadas:', Object.keys(data[0]));
    }

    let loadedCount = 0;
    let attendingCount = 0;
    let notAttendingCount = 0;

    // SOLO CARGAR PERSONAS, NO ASIGNAR MESAS AUTOMÁTICAMENTE
    data.forEach((row, index) => {
        // Obtener columnas con todas las variaciones posibles
        const nombre = (
            row['Nombre'] || 
            row['nombre'] || 
            row['NOMBRE'] ||
            row['Name'] ||
            row['name'] ||
            row['NAME']
        );

        const asiste = (
            row['Asiste'] || 
            row['asiste'] || 
            row['ASISTE'] ||
            row['Attending'] ||
            row['attending'] ||
            row['ATTENDING']
        );

        // Solo procesar si hay nombre
        if (nombre && String(nombre).trim() !== '') {
            const nombreTrimmed = String(nombre).trim();
            
            // Determinar si asiste
            let asisteBoolean = true; // Por defecto asumimos que sí asiste
            if (asiste !== undefined && asiste !== null && asiste !== '') {
                const asisteStr = String(asiste).toLowerCase().trim();
                asisteBoolean = ['true', 'sí', 'si', 'yes', 'y', '1', 'x', 's'].includes(asisteStr);
            }

            // Agregar persona si no existe
            if (!persons.find(p => p.nombre === nombreTrimmed)) {
                persons.push({
                    nombre: nombreTrimmed,
                    asiste: asisteBoolean
                });
                loadedCount++;
                
                if (asisteBoolean) {
                    attendingCount++;
                } else {
                    notAttendingCount++;
                }
                
                console.log(`  ✅ Fila ${index + 1}: "${nombreTrimmed}" cargado | Asiste: ${asisteBoolean ? 'Sí' : 'No'}`);
            }
        }
    });

    console.log('\n📊 === RESUMEN DE CARGA ===');
    console.log(`✅ Personas cargadas: ${loadedCount}`);
    console.log(`👥 Confirman asistencia: ${attendingCount}`);
    console.log(`🚫 No asisten: ${notAttendingCount}`);

    // Renderizar la interfaz (todas las personas estarán en la lista lateral)
    console.log('\n🎨 Renderizando interfaz...');
    renderTables();
    renderPersonList();
    console.log('✅ Interfaz actualizada\n');
    
    // Mostrar alerta al usuario
    alert(`✅ Archivo cargado exitosamente!\n\n📊 Resumen:\n- Total de personas: ${loadedCount}\n- Confirman asistencia: ${attendingCount}\n- No asisten: ${notAttendingCount}\n\n💡 Presiona "⚡ Auto-Asignar desde Excel" para aplicar las asignaciones del archivo.`);
}

function downloadJSON() {
    const data = [];
    
    Object.entries(tables).forEach(([mesa, personNames]) => {
        personNames.forEach(nombre => {
            const personObj = persons.find(p => p.nombre === nombre);
            data.push({ 
                Mesa: mesa, 
                Nombre: nombre,
                Asiste: personObj ? personObj.asiste : false
            });
        });
    });
    
    const unassigned = persons.filter(p => !isPersonAssigned(p.nombre));
    unassigned.forEach(person => {
        data.push({ 
            Mesa: '', 
            Nombre: person.nombre,
            Asiste: person.asiste
        });
    });

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asignacion_mesas_${getTimestamp()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadCSV() {
    const data = [];
    
    Object.entries(tables).forEach(([mesa, personNames]) => {
        personNames.forEach(nombre => {
            const personObj = persons.find(p => p.nombre === nombre);
            data.push({ 
                Mesa: mesa, 
                Nombre: nombre,
                Asiste: personObj && personObj.asiste ? 'Sí' : 'No'
            });
        });
    });
    
    const unassigned = persons.filter(p => !isPersonAssigned(p.nombre));
    unassigned.forEach(person => {
        data.push({ 
            Mesa: '', 
            Nombre: person.nombre,
            Asiste: person.asiste ? 'Sí' : 'No'
        });
    });

    const csv = Papa.unparse(data, {
        quotes: true,
        header: true
    });
    
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asignacion_mesas_${getTimestamp()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadExcel() {
    const data = [];
    
    Object.entries(tables).forEach(([mesa, personNames]) => {
        personNames.forEach(nombre => {
            const personObj = persons.find(p => p.nombre === nombre);
            data.push({ 
                Mesa: mesa, 
                Nombre: nombre,
                Asiste: personObj && personObj.asiste ? 'Sí' : 'No'
            });
        });
    });
    
    const unassigned = persons.filter(p => !isPersonAssigned(p.nombre));
    unassigned.forEach(person => {
        data.push({ 
            Mesa: '', 
            Nombre: person.nombre,
            Asiste: person.asiste ? 'Sí' : 'No'
        });
    });

    const ws = XLSX.utils.json_to_sheet(data);
    
    ws['!cols'] = [
        { wch: 20 }, // Mesa
        { wch: 30 }, // Nombre
        { wch: 10 }  // Asiste
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asignación');
    XLSX.writeFile(wb, `asignacion_mesas_${getTimestamp()}.xlsx`);
}

function getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}`;
}

document.getElementById('newPersonName').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addPerson();
    }
});

initializeTables();