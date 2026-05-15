# Script de Comparación de Archivos de Wordle

Este script compara los archivos de soluciones de Wordle para identificar discrepancias entre los archivos base y los archivos de soluciones procesadas.

## Archivos que se comparan:

### Comparación 1: accent.json vs solutions-accent.json
- **accent.json**: Contiene las palabras base con acentos
- **solutions-accent.json**: Contiene las soluciones procesadas con acentos

### Comparación 2: normal.json vs solutions-normal.json
- **normal.json**: Contiene las palabras base sin acentos
- **solutions-normal.json**: Contiene las soluciones procesadas sin acentos

## Funcionalidades del script:

1. **Palabras no encontradas**: Identifica palabras que existen en los archivos base pero no en los archivos de soluciones
2. **Palabras diferentes**: Detecta cuando para el mismo ID hay palabras diferentes entre los archivos
3. **Rango de comparación**: Se basa en el máximo ID presente en los archivos solutions-xxxxx.json
4. **Orden incremental**: Compara los IDs en orden incremental
5. **Modo de corrección (`--fix`)**: Corrige automáticamente los archivos base (`accent.json` y `normal.json`)

## Modo de corrección `--fix`

Cuando ejecutas el script con `--fix`, se aplican cambios automáticos en los archivos solutions (`solutions-accent.json` y `solutions-normal.json`) basándose en los archivos base (`accent.json` y `normal.json`):

- Si una palabra existe en `accent.json` o `normal.json` pero no existe en `solutions-*.json`, se añade a `solutions-*.json`.
- Si una entrada existe en ambos archivos pero con palabras distintas para el mismo ID, se reemplaza la palabra en `solutions-*.json` con la del archivo base.

Este modo modifica archivos en disco, así que se recomienda revisar cambios con Git después de ejecutarlo.

## Cómo ejecutar:

### Opción 1: Con npm script
```bash
npm run compare
```

### Opción 1b: Con npm script y corrección automática
```bash
npm run compare:fix
```

### Opción 2: Directamente con TypeScript
```bash
npx ts-node src/compareFiles.ts
```

### Opción 2b: TypeScript con corrección automática
```bash
npx ts-node src/compareFiles.ts --fix
```

### Opción 3: Con JavaScript compilado
```bash
npm run build
node build/compareFiles.js
```

### Opción 3b: JavaScript compilado con corrección automática
```bash
npm run build
node build/compareFiles.js --fix
```

## Salida del script:

El script muestra:
- Estadísticas de cada archivo (número total de palabras)
- Lista detallada de discrepancias encontradas
- Resumen final con conteos de:
  - Palabras que coinciden
  - Palabras no encontradas en solutions
  - Palabras diferentes para el mismo ID
  - (Con `--fix`) Palabras corregidas/añadidas a solutions
- ❌ : Palabra existe en archivo base pero no en solutions
- ⚠️  : Palabras diferentes para el mismo ID
- 📊 : Estadísticas
- 📍 : Información de rango
- 📈 : Resumen final
