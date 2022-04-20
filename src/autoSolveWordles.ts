import fs from 'fs/promises'
import puppeteer from 'puppeteer'
import { WordleType } from './defs'
import { getTodaysGameId } from './services/getTodaysGameId'
import { WordleSolver } from './solver/WordleSolver'

const WORDLE_BASE_URL = 'https://wordle.danielfrg.com'
const WORDLE_CREATE_NEW_URL = `${WORDLE_BASE_URL}/crear`

type GameSolution = {
    gameId: number
    word: string
    url: string
}

type GameSolutionsContent = GameSolution[]

type WordleTypeDefinition = {
    url: string
    useAccent: boolean
    solutionsFile: string
}

const WORDLES: { [ key in WordleType ]: WordleTypeDefinition } = {
    NORMAL: {
        url: WORDLE_BASE_URL,
        useAccent: false,
        solutionsFile: `${__dirname}/../solutions/solutions-normal.json`,
    },
    ACCENT: {
        url: `${WORDLE_BASE_URL}/tildes`,
        useAccent: true,
        solutionsFile: `${__dirname}/../solutions/solutions-accent.json`,
    },
    SCIENCE: {
        url: `${WORDLE_BASE_URL}/ciencia`,
        useAccent: false,
        solutionsFile: `${__dirname}/../solutions/solutions-science.json`,
    },
}

async function main() {

    const HEADLESS_BROWSER = true
    let browser: puppeteer.Browser
    let page: puppeteer.Page

    try {
        await start()
    }
    catch( error ) {
        console.error( error )
        await closeBrowser()
    }

    async function start() {

        console.log( 'Starting...' )
        await openBrowser()
        await closeInstructions()

        for( const type in WORDLES ) {
            const wordleType = type as WordleType
            const { url, solutionsFile, useAccent } = WORDLES[ wordleType ]
            const gameId = getTodaysGameId( wordleType )

            const solutions: GameSolutionsContent = JSON.parse( await fs.readFile( solutionsFile, 'utf8' ) )

            const existsSolution = solutions.some( solution => solution.gameId === gameId )
            if( existsSolution ) {
                console.log( `✅ Solution for gameId: ${gameId} already exists` )
                continue
            }

            console.log( `🔍 Solving Wordle (${wordleType}) for gameId ${gameId}...` )
            const result = await solveWordle( url )
            const { word } = result

            if( !word ) {
                console.log( `❌ Error getting solution for gameId: ${gameId}` )
                continue
            }

            console.log( `🎉 Found word for Worlde (${wordleType}):`, result )
            const customWordleUrl = await getCustomWordleFor( word, useAccent )

            solutions.push( { gameId, word, url: customWordleUrl } )
            solutions.sort( ( a, b ) => b.gameId - a.gameId )

            await fs.writeFile( solutionsFile, JSON.stringify( solutions, null, 2 ) )
            console.log( `✅ Solution for gameId: ${gameId} added` )
        }

        await closeBrowser()
    }

    async function openBrowser() {
        browser = await puppeteer.launch( { headless: HEADLESS_BROWSER } )
    }

    async function closeInstructions() {
        const startPage = await browser.newPage()
        await startPage.goto( WORDLE_BASE_URL, { waitUntil: 'networkidle2' } )
        await startPage.close()
   }

    async function openPage( url: string ) {
        await closePage()
        page = await browser.newPage()
        await page.goto( url, { waitUntil: 'networkidle2' } )
    }

    async function closePage() {
        page && page.isClosed() && await page.close()
    }

    async function closeBrowser() {
        await browser.close()
    }

    async function loadDictionary( url: string ): Promise< string[] | undefined > {
        await openPage( url )
        const cells = await page.$$( `main > div > div:nth-child(1) > div` )
        const numOfLetters = cells.length
        if( numOfLetters === 0 ) return
        const { default: dictionary }: { default: string[] } = await import( `./dictionaries/words-${numOfLetters}-es.json` )
        return dictionary
    }

    async function solveWordle( wordleUrl: string) {

        const dictionary = await loadDictionary( wordleUrl )
        if( !dictionary ) return { round: 0, word: undefined }

        const itHasAccents = await hasAccents()
        const wordleSolver = new WordleSolver( dictionary )

        let word = sortWordsWithMoreLetters( dictionary )[ 0 ]
        let currentRound = 7
        let totalRounds = 1
        let solution
        while( !solution ) {
            if( currentRound > 6 ) {
                await startNewWordle( wordleUrl )
                currentRound = 1
            }
            const roundResult = await playRound( currentRound, itHasAccents ? word : normalizeAccents( word ) )

            if( !roundResult.validLetters.includes( '-' ) ) {
                solution = word
                console.log( `✅ Word found in round ${totalRounds}: ${solution}` )
                break
            }

            const possibleWords = wordleSolver.solve( roundResult )
            const wordsWithMoreLetters = sortWordsWithMoreLetters( possibleWords )

            word = wordsWithMoreLetters[ 0 ]
            currentRound++
            totalRounds++

            if( wordsWithMoreLetters.length === 0 ) {
                console.log( `❌ No words found in round ${totalRounds}` )
                break
            }
            if( wordsWithMoreLetters.length === 1 ) {
                solution = wordsWithMoreLetters[ 0 ]
                console.log( `✅ Word found in round ${totalRounds}: ${solution}` )
                break
            }
        }

        return {
            round: totalRounds,
            word: solution
        }
    }

    async function startNewWordle( wordleUrl: string ) {
        await openPage( wordleUrl )
    }

    async function playRound( round: number, word: string ) {
        console.log( '🎮 Round: ', round, 'Word: ', word )
        await inputWord( word )
        let validLetters = ''
        let notInPlaceLetters = ''
        let invalidLetters = ''
        for( let letterIndex = 1; letterIndex <= word.length; letterIndex++ ) {
            const letter = word[ letterIndex - 1 ]
            const element = await page.$( `main > div > div:nth-child(${round}) > :nth-child(${letterIndex}) .react-card-back > div` )
            if( !element ) throw new Error( `Can't find the cells for round ${round}` )
            const className = await element.getProperty( 'className' )
            const classNameValues = ( await className.jsonValue() as string ).split( ' ' )

            validLetters += classNameValues.includes( 'bg-correct' ) ? letter : '-'
            notInPlaceLetters += classNameValues.includes( 'bg-present' ) ? letter : '-'
            invalidLetters += classNameValues.includes( 'bg-absent' ) ? letter : ''
        }
        return { validLetters, notInPlaceLetters, invalidLetters }
    }

    async function hasAccents() {
        const element = await page.$( `[aria-label=á]` )
        return Boolean( element )
    }
    async function inputWord( word: string ) {
        for( const letter of word ) {
            await page.waitForTimeout( 100 )
            const element = await page.$( `[aria-label=${letter}]` )
            if( !element ) throw new Error( `letter ${letter} not found` )
            await element.click()
        }
        const element = await page.$( '[aria-label="procesar palabra"]' )
        if( !element ) throw new Error( `button to send word not found` )
        await element.click()
    }

    function normalizeAccents( word: string ) {
        return word.replace( /á/g, 'a' )
            .replace( /é/g, 'e' )
            .replace( /í/g, 'i' )
            .replace( /ó/g, 'o' )
            .replace( /ú/g, 'u' );
    }

    function sortWordsWithMoreLetters( words: string[] ) {
        return words
            .map( word => ( { word, letters: [ ...new Set( word.split( '' ) ) ].length } ) )
            .sort( ( a, b ) => b.letters - a.letters )
            .map( ( { word } ) => word )
    }

    async function getCustomWordleFor( word: string, useAccent: boolean ) {
        await openPage( WORDLE_CREATE_NEW_URL)
        for( const letter of word ) {
            await page.waitForTimeout( 300 )
            const element = await page.waitForSelector( `[aria-label=${letter}]` )
            if( !element ) throw new Error( `letter ${letter} not found` )
            await element.click()
        }
        {
            const element = await page.waitForSelector( '[aria-label="procesar palabra"]' )
            if( !element ) throw new Error( `button to send word not found` )
            await element.click()
        }
        {
            const element = await page.waitForSelector( '[href*="https://wordle.danielfrg.com/personalizada"]' )
            if( !element ) throw new Error( `button to send word not found` )
            const href = await element.getProperty( 'href' )
            const url = await href.jsonValue() as string
            return useAccent ? url.replace( '&t=false', '&t=true' ) : url
        }
    }

}

main()