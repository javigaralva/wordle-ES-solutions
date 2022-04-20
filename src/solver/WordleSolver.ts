export type SolveParams = {
    validLetters: string
    notInPlaceLetters: string
    invalidLetters: string
}

export class WordleSolver {
    private validLetters: string = ''
    private notInPlaceLetters: string[] = []
    private invalidLetters: string = ''
    private validIndexes: number[] = []
    private notCompletedIndexes: number[] = []
    private possibleWords: string[] = []
    private ALL_WORDS: string[] = []

    constructor( allWords: string[] ) {
        this.ALL_WORDS = allWords
        this.possibleWords = this.ALL_WORDS
        this.reset()
    }

    reset() {
        this.validLetters = ''
        this.notInPlaceLetters = []
        this.invalidLetters = ''
        this.validIndexes = []
        this.notCompletedIndexes = []
        this.possibleWords = this.ALL_WORDS
    }

    solve( solveParams: SolveParams ) {
        this.validLetters = solveParams?.validLetters.toLowerCase() || this.validLetters
        this.notInPlaceLetters.push( solveParams.notInPlaceLetters )
        this.invalidLetters += solveParams.invalidLetters

        this.initializeIndexes()

        this.possibleWords = this.filterWordsWithCorrectLetters( this.ALL_WORDS )
        this.possibleWords = this.removeWordsWithInvalidLetters( this.possibleWords )
        this.possibleWords = this.removeWordsWithNotInPlaceIndexes( this.possibleWords )
        this.possibleWords = this.removeInvalidNotInPlaceCombinations( this.possibleWords )

        return this.possibleWords
    }

    getPossibleWords() {
        return this.possibleWords
    }

    private initializeIndexes() {
        const wordLength = this.getWordLength()
        for( let i = 0; i < wordLength; i++ ) {
            const letter = this.validLetters[ i ]
            this.isEmpty( letter )
                ? this.notCompletedIndexes.push( i )
                : this.validIndexes.push( i )
        }
    }

    private isEmpty( char: string ): boolean {
        return char === '_' || char === ' ' || char === '-' || char === undefined
    }

    private getWordLength() {
        return this.ALL_WORDS[ 0 ].length
    }

    private filterWordsWithCorrectLetters( words: string[] ) {
        return words.filter( word => {
            let isValid = true
            for( let i = 0; i < this.validIndexes.length; i++ ) {
                const index = this.validIndexes[ i ]
                const letter = word[ index ]
                if( letter !== this.validLetters[ index ] ) {
                    isValid = false
                    break
                }
            }
            return isValid
        } )
    }

    private removeWordsWithInvalidLetters( words: string[] ) {
        return words.filter( word => {
            let wordWithoutValidLetters = ''
            for( let i = 0; i < word.length; i++ ) {
                const letter = word[ i ]
                if( this.validLetters[ i ] !== letter ) {
                    wordWithoutValidLetters += letter
                }
            }
            return !this.invalidLetters
                .split( '' )
                .some( letter => {
                    const existsLetterInNotInPlaceLetters = this.notInPlaceLetters.some(
                        notInPlaceLetters => notInPlaceLetters.includes( letter )
                    )
                    return existsLetterInNotInPlaceLetters
                        ? false
                        : wordWithoutValidLetters.includes( letter )
                } )
        } )
    }

    private removeWordsWithNotInPlaceIndexes( words: string[] ) {
        return words.filter(
            word => !this.notCompletedIndexes.some(
                index => this.notInPlaceLetters[ index ] === word[ index ]
            )
        )
    }

    private removeInvalidNotInPlaceCombinations( words: string[] ) {
        return this.notInPlaceLetters.reduce(
            ( wordsRemaining, notInPlace ) =>
                wordsRemaining.filter( word => {
                    let isValid = true
                    const splitWord = word.split( '' )
                    for( let j = 0; j < notInPlace.length; j++ ) {
                        const letterNotInPlace = notInPlace[ j ]

                        if( this.isEmpty( letterNotInPlace ) ) continue
                        if( word[ j ] === letterNotInPlace ) return false

                        isValid &&= splitWord.some( ( letter, i ) => {
                            if( i === j ) return false
                            return letter === letterNotInPlace
                        } )

                        if( !isValid )
                            return false
                    }
                    return true
                } )
            , words )
    }
}
