import fs from 'fs/promises'
import { Browser, Page } from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
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
    let browser: Browser
    let page: Page

    const NUM_OF_ROUNDS = 6
    const MIN_LETTERS_TO_CREATE_WORDLE = 5

    const RGB_CELL_COLORS = {
        CORRECT : 'rgb(106, 170, 100)',
        PRESENT : 'rgb(201, 180, 88)',
        ABSENT  : 'rgb(120, 124, 126)'
    }

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
                console.log( `??? Solution for gameId: ${gameId} already exists` )
                continue
            }

            console.log( `???? Solving Wordle (${wordleType}) for gameId ${gameId}...` )
            const result = await solveWordle( url )
            const { word } = result

            if( !word ) {
                console.log( `??? Error getting solution for gameId: ${gameId}` )
                continue
            }

            console.log( `???? Found word for Worlde (${wordleType}):`, result )

            let customWordleUrl = ( result.word?.length ?? 0 ) >= MIN_LETTERS_TO_CREATE_WORDLE
                ? await getCustomWordleFor( word, useAccent )
                : ''

            solutions.push( { gameId, word, url: customWordleUrl } )
            solutions.sort( ( a, b ) => b.gameId - a.gameId )

            await fs.writeFile( solutionsFile, JSON.stringify( solutions, null, 2 ) )
            console.log( `??? Solution for gameId: ${gameId} added` )
        }

        await closeBrowser()
    }

    async function openBrowser() {
        // add stealth plugin and use defaults (all evasion techniques)
        puppeteer.use( StealthPlugin() )
        browser = await puppeteer.launch( { headless: HEADLESS_BROWSER } )
    }

    async function closeInstructions() {
        const startPage = await browser.newPage()
        await startPage.goto( WORDLE_BASE_URL, { waitUntil: 'networkidle2' } )
        try {
            const consentButton = await startPage.waitForSelector( 'button[mode="primary"]', { timeout: 5000 } )
            consentButton && await consentButton.click()
        }
        catch( error ) {
            console.log( '???? No consent button found' )
        }
        await startPage.close()
   }

    async function openPage( url: string ) {
        await closePage()
        page = await browser.newPage()
        await page.goto( url, { waitUntil: 'networkidle2' } )
    }

    async function closePage() {
        page && !page.isClosed() && await page.close()
    }

    async function closeBrowser() {
        await browser.close()
    }

    async function loadDictionary( url: string ): Promise< string[] | undefined > {
        await openPage( url )
        const cells = await page.$$( `.react-card-flip` )
        const numOfLetters = cells.length / NUM_OF_ROUNDS
        if( numOfLetters === 0 ) return
        const { default: dictionary }: { default: string[] } = await import( `./dictionaries/words-${numOfLetters}-es.json` )
        return dictionary
    }

    async function solveWordle( wordleUrl: string) {

        const dictionary = await loadDictionary( wordleUrl )
        if( !dictionary ) return { round: 0, word: undefined }

        const itHasAccents = await hasAccents()

        const dualDictionary = dictionary.map( word => ( [ word, normalizeAccents( word ) ] ) )
        const dictionaryToUse = itHasAccents ? dictionary : dualDictionary.map( ( [ _, word ] ) => word )

        const wordleSolver = new WordleSolver( dictionaryToUse )

        let word = sortWordsWithMoreLetters( dictionary )[ 0 ]
        let currentRound = NUM_OF_ROUNDS + 1
        let totalRounds = 1
        let solution
        while( !solution ) {
            if( currentRound > NUM_OF_ROUNDS ) {
                await startNewWordle( wordleUrl )
                currentRound = 1
            }
            const roundResult = await playRound( currentRound, itHasAccents ? word : normalizeAccents( word ) )

            if( !roundResult.validLetters.includes( '-' ) ) {
                solution = itHasAccents ? word : findWordInDualDictionary( word, dualDictionary )
                console.log( `??? Word found in round ${totalRounds}: ${solution}` )
                break
            }

            const possibleWords = wordleSolver.solve( roundResult )
            const wordsWithMoreLetters = sortWordsWithMoreLetters( possibleWords )

            word = wordsWithMoreLetters[ 0 ]
            currentRound++
            totalRounds++

            if( totalRounds > NUM_OF_ROUNDS * 2 ) {
                console.log( `??? No solution found in ${NUM_OF_ROUNDS * 2} rounds` )
                break
            }
            if( wordsWithMoreLetters.length === 0 ) {
                console.log( `??? No words found in round ${totalRounds}` )
                break
            }
            if( wordsWithMoreLetters.length === 1 ) {
                const theWord = wordsWithMoreLetters[ 0 ]
                solution = itHasAccents ? theWord : findWordInDualDictionary( theWord, dualDictionary )
                console.log( `??? Word found in round ${totalRounds}: ${solution}` )
                break
            }
        }

        return {
            round: totalRounds,
            word: solution
        }
    }

    async function startNewWordle( wordleUrl: string ) {
        await page.evaluate( () => localStorage.setItem( 'board', '' ) )
        await openPage( wordleUrl )
    }

    async function playRound( round: number, word: string ) {
        console.log( '???? Round: ', round, 'Word: ', word )
        await inputWord( word )
        let validLetters = ''
        let notInPlaceLetters = ''
        let invalidLetters = ''
        for( let letterIndex = 1; letterIndex <= word.length; letterIndex++ ) {
            const letter = word[ letterIndex - 1 ]
            const cellStateColor = await page.evaluate( ( { round, letterIndex } ) => {
                const cellStateElement = document.querySelector( `div > div:nth-child(${round}) > div:nth-child(${letterIndex}) > div > div.react-card-back > div` )
                return cellStateElement && window.getComputedStyle( cellStateElement ).getPropertyValue( 'background-color' )
            }, { round, letterIndex } )

            if( !cellStateColor ) throw new Error( `Can't find the cells for round ${round}` )

            validLetters      += cellStateColor === RGB_CELL_COLORS.CORRECT ? letter : '-'
            notInPlaceLetters += cellStateColor === RGB_CELL_COLORS.PRESENT ? letter : '-'
            invalidLetters    += cellStateColor === RGB_CELL_COLORS.ABSENT  ? letter : ''
        }
        return { validLetters, notInPlaceLetters, invalidLetters }
    }

    async function hasAccents() {
        const element = await page.$( `[aria-label=??]` )
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
        return word.replace( /??/g, 'a' )
            .replace( /??/g, 'e' )
            .replace( /??/g, 'i' )
            .replace( /??/g, 'o' )
            .replace( /??/g, 'u' );
    }

    function sortWordsWithMoreLetters( words: string[] ) {
        return words
            .map( word => ( { word, letters: [ ...new Set( word.split( '' ) ) ].length } ) )
            .sort( ( a, b ) => b.letters - a.letters )
            .map( ( { word } ) => word )
    }

    function findWordInDualDictionary( word: string, dictionary: string[][] ) {
        return dictionary.find( ( [ _, w ] ) => w === word )?.[ 0 ]
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