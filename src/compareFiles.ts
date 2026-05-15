import fs from 'node:fs'
import path from 'node:path'

type AccentSolution = {
    id: number
    solution: string
    extras: {}
}

type NormalSolution = {
    id: number
    solution: string
    extras: {}
}

type GameSolution = {
    gameId: number
    word: string
}

type ComparisonResult<T> = {
    updatedData: T[]
    hasChanges: boolean
}

function compareFiles() {
    const shouldFix = process.argv.includes('--fix')

    console.log('🔍 Comparando archivos de soluciones...\n')
    if (shouldFix) {
        console.log('🛠️  Modo fix activado: se aplicarán correcciones en solutions-*.json.\n')
    }
    
    // Leer archivos
    const accentPath = path.join(__dirname, '../solutions/accent.json')
    const normalPath = path.join(__dirname, '../solutions/normal.json')
    const solutionsAccentPath = path.join(__dirname, '../solutions/solutions-accent.json')
    const solutionsNormalPath = path.join(__dirname, '../solutions/solutions-normal.json')

    const missingBaseFiles = [accentPath, normalPath].filter(filePath => !fs.existsSync(filePath))
    if (missingBaseFiles.length > 0) {
        console.error('❌ No se encontraron archivos base requeridos en /solutions.')
        console.error('Debes añadir estos archivos manualmente antes de ejecutar compare:')
        missingBaseFiles.forEach(filePath => {
            console.error(`- /solutions/${path.basename(filePath)}`)
        })
        process.exit(1)
    }
    
    const accentData: AccentSolution[] = JSON.parse(fs.readFileSync(accentPath, 'utf8'))
    const normalData: NormalSolution[] = JSON.parse(fs.readFileSync(normalPath, 'utf8'))
    const solutionsAccentData: GameSolution[] = JSON.parse(fs.readFileSync(solutionsAccentPath, 'utf8'))
    const solutionsNormalData: GameSolution[] = JSON.parse(fs.readFileSync(solutionsNormalPath, 'utf8'))
    
    console.log('📊 Estadísticas de archivos:')
    console.log(`- accent.json: ${accentData.length} palabras`)
    console.log(`- normal.json: ${normalData.length} palabras`)
    console.log(`- solutions-accent.json: ${solutionsAccentData.length} palabras`)
    console.log(`- solutions-normal.json: ${solutionsNormalData.length} palabras\n`)
    
    // Comparar archivos accent
    console.log('🔸 COMPARACIÓN: accent.json vs solutions-accent.json')
    console.log('=' .repeat(60))
    const accentResult = compareAccentFiles(accentData, solutionsAccentData, shouldFix)
    
    console.log('\n')
    
    // Comparar archivos normal
    console.log('🔸 COMPARACIÓN: normal.json vs solutions-normal.json')
    console.log('=' .repeat(60))
    const normalResult = compareNormalFiles(normalData, solutionsNormalData, shouldFix)

    if (shouldFix) {
        if (accentResult.hasChanges) {
            fs.writeFileSync(solutionsAccentPath, JSON.stringify(accentResult.updatedData, null, 2) + '\n')
            console.log(`\n✍️  Archivo actualizado: ${solutionsAccentPath}`)
        }

        if (normalResult.hasChanges) {
            fs.writeFileSync(solutionsNormalPath, JSON.stringify(normalResult.updatedData, null, 2) + '\n')
            console.log(`✍️  Archivo actualizado: ${solutionsNormalPath}`)
        }

        if (!accentResult.hasChanges && !normalResult.hasChanges) {
            console.log('\n✅ No había cambios que aplicar.')
        }
    }
}

function compareAccentFiles(accentData: AccentSolution[], solutionsData: GameSolution[], shouldFix: boolean): ComparisonResult<GameSolution> {
    // Crear mapas para búsqueda rápida
    const accentMap = new Map<number, string>()
    accentData.forEach(item => accentMap.set(item.id, item.solution))
    
    const solutionsMap = new Map<number, GameSolution>()
    solutionsData.forEach(item => solutionsMap.set(item.gameId, { ...item }))
    
    // Obtener el rango máximo basado en solutions-accent.json
    const maxGameId = Math.max(...solutionsData.map(s => s.gameId))
    const minGameId = Math.min(...solutionsData.map(s => s.gameId))
    
    console.log(`📍 Rango de comparación: ID ${minGameId} a ${maxGameId} (basado en solutions-accent.json)`)
    console.log()
    
    let wordsNotInSolutions = 0
    let differentWords = 0
    let matchingWords = 0
    let fixedWords = 0
    let hasChanges = false
    
    // Iterar por el rango incremental de IDs
    for (let id = minGameId; id <= maxGameId; id++) {
        const accentWord = accentMap.get(id)
        const solutionItem = solutionsMap.get(id)
        
        if (accentWord && !solutionItem) {
            console.log(`❌ ID ${id}: Palabra "${accentWord}" existe en accent.json pero NO en solutions-accent.json`)
            wordsNotInSolutions++
            if (shouldFix) {
                solutionsMap.set(id, { gameId: id, word: accentWord })
                fixedWords++
                hasChanges = true
            }
        } else if (accentWord && solutionItem && accentWord !== solutionItem.word) {
            console.log(`⚠️  ID ${id}: Palabras diferentes - accent.json: "${accentWord}" | solutions-accent.json: "${solutionItem.word}"`)
            differentWords++
            if (shouldFix) {
                solutionItem.word = accentWord
                fixedWords++
                hasChanges = true
            }
        } else if (accentWord && solutionItem && accentWord === solutionItem.word) {
            matchingWords++
        }
    }
    
    console.log()
    console.log('📈 RESUMEN accent vs solutions-accent:')
    console.log(`- Palabras que coinciden: ${matchingWords}`)
    console.log(`- Palabras no encontradas en solutions-accent.json: ${wordsNotInSolutions}`)
    console.log(`- Palabras diferentes para el mismo ID: ${differentWords}`)

    if (shouldFix) {
        console.log(`- Palabras corregidas/añadidas automáticamente: ${fixedWords}`)
    }

    return {
        updatedData: Array.from(solutionsMap.values()).sort((a, b) => a.gameId - b.gameId),
        hasChanges,
    }
}

function compareNormalFiles(normalData: NormalSolution[], solutionsData: GameSolution[], shouldFix: boolean): ComparisonResult<GameSolution> {
    // Crear mapas para búsqueda rápida
    const normalMap = new Map<number, string>()
    normalData.forEach(item => normalMap.set(item.id, item.solution))
    
    const solutionsMap = new Map<number, GameSolution>()
    solutionsData.forEach(item => solutionsMap.set(item.gameId, { ...item }))
    
    // Obtener el rango máximo basado en solutions-normal.json
    const maxGameId = Math.max(...solutionsData.map(s => s.gameId))
    const minGameId = Math.min(...solutionsData.map(s => s.gameId))
    
    console.log(`📍 Rango de comparación: ID ${minGameId} a ${maxGameId} (basado en solutions-normal.json)`)
    console.log()
    
    let wordsNotInSolutions = 0
    let differentWords = 0
    let matchingWords = 0
    let fixedWords = 0
    let hasChanges = false
    
    // Iterar por el rango incremental de IDs
    for (let id = minGameId; id <= maxGameId; id++) {
        const normalWord = normalMap.get(id)
        const solutionItem = solutionsMap.get(id)
        
        if (normalWord && !solutionItem) {
            console.log(`❌ ID ${id}: Palabra "${normalWord}" existe en normal.json pero NO en solutions-normal.json`)
            wordsNotInSolutions++
            if (shouldFix) {
                solutionsMap.set(id, { gameId: id, word: normalWord })
                fixedWords++
                hasChanges = true
            }
        } else if (normalWord && solutionItem && normalWord !== solutionItem.word) {
            console.log(`⚠️  ID ${id}: Palabras diferentes - normal.json: "${normalWord}" | solutions-normal.json: "${solutionItem.word}"`)
            differentWords++
            if (shouldFix) {
                solutionItem.word = normalWord
                fixedWords++
                hasChanges = true
            }
        } else if (normalWord && solutionItem && normalWord === solutionItem.word) {
            matchingWords++
        }
    }
    
    console.log()
    console.log('📈 RESUMEN normal vs solutions-normal:')
    console.log(`- Palabras que coinciden: ${matchingWords}`)
    console.log(`- Palabras no encontradas en solutions-normal.json: ${wordsNotInSolutions}`)
    console.log(`- Palabras diferentes para el mismo ID: ${differentWords}`)

    if (shouldFix) {
        console.log(`- Palabras corregidas/añadidas automáticamente: ${fixedWords}`)
    }

    return {
        updatedData: Array.from(solutionsMap.values()).sort((a, b) => a.gameId - b.gameId),
        hasChanges,
    }
}

// Ejecutar la comparación
compareFiles()

