import axios from 'axios'

export async function getWordleSolution( gameId: number ) {
    try {
        const url = `https://www.gamereactor.es/wordle-${gameId + 201}-y-wordle-es-${gameId}-solucion-con-la-palabra-del-reto-de-hoy/`
        console.log( `Fetching word of the day (${url}) ...` )
        const response = await axios.get( url )
        if( !response ) return

        const word = parseResponseData( response.data )
        return word
    }
    catch( error ) {
        console.error( `Error fetching solution for gameId: ${gameId}` )
    }
}

function parseResponseData( data: string ): string | undefined {
    const match = data.matchAll( /solución del reto de Wordle hoy, es (?<word>.{5})/gm )
    const { groups: { word } } = match.next().value ?? { groups: { word: undefined } }
    return word?.toLowerCase()
}
