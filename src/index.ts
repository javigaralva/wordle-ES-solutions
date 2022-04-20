import fs from 'fs/promises'
import { getTodaysGameId } from './services/getTodaysGameId'
import { getWordleSolution } from './services/getWordleSolution'

const SOLUTIONS_FILE = `${__dirname}/../solutions/solutions-normal.json`

type GameSolution = {
    gameId: number
    word: string
}

async function main() {
    const solutions: GameSolution[] = JSON.parse( await fs.readFile( SOLUTIONS_FILE, 'utf8' ) )

    const gameId = getTodaysGameId( 'NORMAL' )

    const existsSolution = solutions.some( solution => solution.gameId === gameId )
    if( existsSolution ) return console.log( `✅ Solution for gameId: ${gameId} already exists` )

    const word = await getWordleSolution( gameId )
    if( !word ) return console.log( `❌ Error getting solution for gameId: ${gameId}` )

    solutions.push( { gameId, word } )
    solutions.sort( ( a, b ) => b.gameId - a.gameId )

    await fs.writeFile( SOLUTIONS_FILE, JSON.stringify( solutions, null, 2 ) )
    console.log( `✅ Solution for gameId: ${gameId} added` )

}
main()
