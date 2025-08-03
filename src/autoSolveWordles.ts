import fs from 'fs/promises'
import { Browser, Page } from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { WordleType } from './defs'
import { getTodaysGameId } from './services/getTodaysGameId'
import WordleSolver from './solver/WordleSolver'

const WORDLE_BASE_URL = 'https://lapalabradeldia.com'
const WORDLE_CREATE_NEW_URL = `${WORDLE_BASE_URL}/crear`
const WORDLE_CUSTOM_URL = `${WORDLE_BASE_URL}/personalizada`

const DEBUG = true

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
}

async function main() {

    const HEADLESS_BROWSER = true
    let browser: Browser
    let page: Page

    const NUM_OF_ROUNDS = 6
    const MIN_LETTERS_TO_CREATE_WORDLE = 5

    const RGB_CELL_COLORS = {
        CORRECT : 'rgb(67, 160, 71)',
        PRESENT : 'rgb(228, 168, 29)',
        ABSENT  : 'rgb(117, 117, 117)'
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
        await closeConsent()

        for( const type in WORDLES ) {
            console.log( '\n' )

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

            console.log( `🎉 Found word for Wordle (${wordleType}):`, result )

            console.log( `🏗️ Creating custom game for gameId ${gameId} and word ${word}...` )
            let customWordleUrl = ( result.word?.length ?? 0 ) >= MIN_LETTERS_TO_CREATE_WORDLE
                ? await getCustomWordleFor( word, useAccent )
                : ''

            solutions.push( { gameId, word, url: customWordleUrl } )
            solutions.sort( ( a, b ) => b.gameId - a.gameId )

            await fs.writeFile( solutionsFile, JSON.stringify( solutions, null, 2 ) )
            console.log( `✅ Solution for gameId: ${gameId} added` )
        }

        await closeBrowser()
    }

    async function openBrowser() {
        // add stealth plugin and use defaults (all evasion techniques)
        DEBUG && console.log( 'Opening browser...' )
        puppeteer.use( StealthPlugin() )
        browser = await puppeteer.launch( { args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: HEADLESS_BROWSER } )
        DEBUG && console.log( 'Browser opened.' )
    }

    async function closeConsent() {
        DEBUG && console.log( 'Closing consent. Opening a new page...' )
        const startPage = await browser.newPage()
        await startPage.goto( WORDLE_BASE_URL, { waitUntil: 'domcontentloaded' } )
        await clickOnConsentButton({ page: startPage })
        DEBUG && console.log( 'Closing the page...' )
        await startPage.close()
    }

    async function closeInstructions() {
        try {
	        DEBUG && console.log( `Closing instructions` )
	        const button = await page.waitForSelector('div[role=dialog] button', { timeout: 1000 })
	        button && (await button.click())
	
        } catch (error) {
            DEBUG && console.log( `No instruction button found` )
        }    
    }

    async function clickOnConsentButton( { page }: { page: Page } ) {
        const CONSENT_BUTTONS_ARIA_LABELS = [
            "Close",   // original
            "Consent"  // new one
        ]
        for( const ariaLabel of CONSENT_BUTTONS_ARIA_LABELS ) {
            try {
                DEBUG && console.log( `Trying to get the close button [${ariaLabel}] and clicking it...` )
                const consentButton = await page.waitForSelector( `button[aria-label="${ariaLabel}"]`, { timeout: 5000 } )
                consentButton && (await consentButton.click())
                console.log( 'Consent button found and clicked.' )
                return
            }
            catch( error ) {
                console.log( `🚫 No consent button found [${ariaLabel}]` )
            }
        }
    }

    async function openPage( url: string ) {
        await closePage()
        page = await browser.newPage()
        await page.goto( url, { waitUntil: 'domcontentloaded' } )
    }

    async function closePage() {
        page && !page.isClosed() && (await page.close())
    }

    async function closeBrowser() {
        await browser.close()
    }

    async function loadDictionary( url: string ): Promise< string[] | undefined > {
        DEBUG && console.log( `Loading dictionary. Opening page ${url}`)
        await openPage( url )
        DEBUG && console.log( `Page ${url} opened.`)
        await closeInstructions()
        DEBUG && console.log( `Try to get the cells...`)
        const numberOfCells = await getNumberOfCells()
        DEBUG && console.log( `Cells get: `, numberOfCells )
        const numOfLetters = numberOfCells / NUM_OF_ROUNDS
        if( numOfLetters === 0 ) return
        const { default: dictionary }: { default: string[] } = await import( `./dictionaries/words-${numOfLetters}-es.json` )
        DEBUG && console.log( 'Dictionary loaded' )
        return dictionary
    }

    async function getNumberOfCells() {
        // try to get one of the selectors
        const CELL_SELECTORS = [
            '.react-card-flip',     // original
            '.react-card-flipper',  // new one
        ]
        for( const selector of CELL_SELECTORS ) {
            await page.waitForSelector( selector )
            const cells = await page.$$( selector )
            if(cells.length > 0) {
                return cells.length
            }
        }

        return 0
    }

    async function solveWordle( wordleUrl: string) {

        const dictionary = await loadDictionary( wordleUrl )
        if( !dictionary ) return { round: 0, word: undefined }

        const itHasAccents = await hasAccents()

        const dualDictionary = dictionary.map( word => ( [ word, normalizeAccents( word ) ] ) )
        const dictionaryToUse = itHasAccents ? dictionary : dualDictionary.map( ( [ _, word ] ) => word )

        const wordleSolver = new WordleSolver( dictionaryToUse )

        let word = selectWord( sortWordsWithMoreLetters( dictionary ) )
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
                console.log( `✅ Word found in round ${totalRounds}: ${solution}` )
                break
            }

            const possibleWords = wordleSolver.solve( roundResult )
            const wordsWithMoreLetters = sortWordsWithMoreLetters( possibleWords )

            word = selectWord( wordsWithMoreLetters )
            currentRound++
            totalRounds++

            if( totalRounds > NUM_OF_ROUNDS * 2 ) {
                console.log( `❌ No solution found in ${NUM_OF_ROUNDS * 2} rounds` )
                break
            }
            if( wordsWithMoreLetters.length === 0 ) {
                console.log( `❌ No words found in round ${totalRounds}` )
                break
            }
            if( wordsWithMoreLetters.length === 1 ) {
                const theWord = wordsWithMoreLetters[ 0 ]
                solution = itHasAccents ? theWord : findWordInDualDictionary( theWord, dualDictionary )
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
        DEBUG && console.log( 'Starting new wordle...')
        DEBUG && console.log( 'Resetting the board...')
        await page.evaluate( () => localStorage.setItem( 'board', '' ) )
        DEBUG && console.log( 'Board reset.')
        DEBUG && console.log( `Open page ${wordleUrl}`)
        await openPage( wordleUrl )
        await closeInstructions()
        DEBUG && console.log( `Page ${wordleUrl} opened.`)
    }

    async function playRound( round: number, word: string ) {
        console.log( '🎮 Round: ', round, 'Word: ', word )
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
        try {
            DEBUG && console.log( 'Trying to know if wordle has accents...')
            await page.waitForSelector( `[aria-label=á]`, { timeout: 1000 } )
            DEBUG && console.log( 'It has accents' )
            return true
        }
        catch( ex ) {
            DEBUG && console.log( 'It has not accents')
            return false
        }
    }
    async function inputWord( word: string ) {
        for( const letter of word ) {
            await page.waitForTimeout( 100 )
            const letterSelector = `[aria-label=${letter}]`
            await page.waitForSelector( letterSelector )
            const element = await page.$( letterSelector )
            if( !element ) {
                throw new Error( `letter ${letter} not found` )
            }
            await element.click()
        }
        const element = await page.$( '[aria-label="procesar palabrakey"]' )
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
            const element = await page.waitForSelector( '[aria-label="procesar palabrakey"]' )
            if( !element ) throw new Error( `button to send word not found` )
            await element.click()
        }
        {
            const element = await page.waitForSelector( `[href*="${WORDLE_CUSTOM_URL}"]` )
            if( !element ) throw new Error( `button to send word not found` )
            const href = await element.getProperty( 'href' )
            const url = await href.jsonValue() as string
            return useAccent ? url.replace( '&t=false', '&t=true' ) : url
        }
    }

    function selectWord( words: string[] ) {
        return pickRandomlyFromFirstElements( words )
    }

    function pickRandomlyFromFirstElements<T>( array: T[], numOfFirstElementsToPick: number = 20 ): T {
        return random( array.slice( 0, numOfFirstElementsToPick ) )
    }

    function random<T>( array: T[] ) {
        return array[ Math.floor( Math.random() * array.length ) ]
    }
}

main()
