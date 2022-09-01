export type SolveParams = {
    validLetters: string
    notInPlaceLetters: string
    invalidLetters: string
}

export type WordleSolverState = {
    validLetters: string
    notInPlaceLetters: string[]
    invalidLetters: string
}

export default class WordleSolver {
    private validLetters: string = ''
    private notInPlaceLetters: string[] = []
    private invalidLetters: string = ''
    private validIndexes: number[] = []
    private notCompletedIndexes: number[] = []
    private possibleWords: string[] = []
    private ALL_WORDS: string[] = []

    constructor(allWords: string[]) {
        this.ALL_WORDS = allWords
        this.possibleWords = this.ALL_WORDS
        this.reset()
        return this
    }

    reset(allWords?: string[] ) {
        this.validLetters = ''
        this.notInPlaceLetters = []
        this.invalidLetters = ''
        this.validIndexes = []
        this.notCompletedIndexes = []
        this.ALL_WORDS = allWords ?? this.ALL_WORDS
        return this
    }

    solve(solveParams: SolveParams) {
        this.initializeNextSolve( solveParams )

        this.possibleWords = this.filterWordsWithCorrectLetters(this.ALL_WORDS)
        this.possibleWords = this.removeWordsWithInvalidLetters(this.possibleWords)
        this.possibleWords = this.removeWordsWithNotInPlaceIndexes(this.possibleWords)
        this.possibleWords = this.removeInvalidNotInPlaceCombinations(this.possibleWords)

        return this.possibleWords
    }

    getPossibleWords() {
        return this.possibleWords
    }

    getState(): WordleSolverState {
        return {
            validLetters: this.getValidLetters(),
            notInPlaceLetters: this.getNotInPlaceLetters(),
            invalidLetters: this.getInvalidLetters(),
        }
    }

    restoreTo(state: WordleSolverState) {

        this.reset()

        // 1 - Add validLetters and invalidLetters (this step reduce the combinations for step 2 to make it faster)
        this.solve({
            ...state,
            notInPlaceLetters: '',
        })

        // 2 - Add all not in place letters steps
        state.notInPlaceLetters.forEach(notInPlaceLettersStep => {
            this.solve({
                validLetters: '',
                invalidLetters: '',
                notInPlaceLetters: notInPlaceLettersStep,
            })
        })

        return this.getPossibleWords()
    }

    getValidLetters() {
        return this.validLetters
    }

    getNotInPlaceLetters() {
        return [...this.notInPlaceLetters]
    }

    getInvalidLetters() {
        return this.invalidLetters
    }

    getWordLength() {
        return this.ALL_WORDS[0].length
    }

    private initializeNextSolve(solveParams: SolveParams) {
        solveParams = this.sanitizeSolveParams(solveParams)
        this.addValidLetters(solveParams.validLetters)
        this.addNotInPlaceLetters(solveParams.notInPlaceLetters)
        this.addInvalidLetters(solveParams.invalidLetters)

        this.initializeIndexes()
    }

    private sanitizeSolveParams(solveParams: SolveParams): SolveParams {
        return {
            validLetters: this.sanitizeInput(solveParams?.validLetters),
            notInPlaceLetters: this.sanitizeInput(solveParams?.notInPlaceLetters),
            invalidLetters: this.sanitizeInput(solveParams?.invalidLetters),
        }
    }

    private sanitizeInput(input: string) {
        return input.toLowerCase().trimEnd()
    }

    private addValidLetters(newValidLetters: string) {
        const wordLength = this.getWordLength()
        const currentValidLetters = this.validLetters.padEnd(wordLength, ' ')
        newValidLetters = newValidLetters.padEnd(wordLength, ' ')

        let finalValidLetters = ''
        for (let i = 0; i < wordLength; i++) {
            const currentValidLetter = currentValidLetters[i]
            const newValidLetter = newValidLetters[i]
            const hasCollision = !this.isEmpty(currentValidLetter) && !this.isEmpty(newValidLetter) && currentValidLetter !== newValidLetter
            if (hasCollision) {
                // throw new Error(`WordleSolver: there is a collision with previous valid letter data in index ${i} (currentValidLetters: ${currentValidLetters} newValidLetters: ${newValidLetters})`)
                this.validLetters = '?'.repeat(wordLength)
                return
            }
            if (!this.isEmpty(currentValidLetter)) {
                finalValidLetters += currentValidLetter
            } else if (!this.isEmpty(newValidLetter)) {
                finalValidLetters += newValidLetter
            } else {
                finalValidLetters += ' '
            }
        }
        this.validLetters = finalValidLetters
    }

    private addNotInPlaceLetters(notInPlaceLetters: string) {
        if (!notInPlaceLetters) return
        this.notInPlaceLetters = [...new Set(this.notInPlaceLetters.concat(notInPlaceLetters))]
    }

    private addInvalidLetters(invalidLetters: string) {
        this.invalidLetters = this.removeDuplicates(this.invalidLetters + invalidLetters)
    }

    private removeDuplicates(string: string) {
        return [...new Set(string.split(''))].join('')
    }

    private initializeIndexes() {
        this.validIndexes = []
        this.notCompletedIndexes = []
        const wordLength = this.getWordLength()
        for (let i = 0; i < wordLength; i++) {
            const letter = this.validLetters[i]
            this.isEmpty(letter)
                ? this.notCompletedIndexes.push(i)
                : this.validIndexes.push(i)
        }
    }

    private isEmpty(char: string): boolean {
        return char === '_' || char === ' ' || char === '-' || char === '·' || char === undefined
    }

    private filterWordsWithCorrectLetters(words: string[]) {
        return words.filter(word => {
            let isValid = true
            for (let i = 0; i < this.validIndexes.length; i++) {
                const index = this.validIndexes[i]
                const letter = word[index]
                if (letter !== this.validLetters[index]) {
                    isValid = false
                    break
                }
            }
            return isValid
        })
    }

    private removeWordsWithInvalidLetters(words: string[]) {
        return words.filter(word => {
            let wordWithoutValidLetters = ''
            for (let i = 0; i < word.length; i++) {
                const letter = word[i]
                if (this.validLetters[i] !== letter) {
                    wordWithoutValidLetters += letter
                }
            }
            return !this.invalidLetters
                .split('')
                .some(letter => {
                    const existsLetterInNotInPlaceLetters = this.notInPlaceLetters.some(
                        notInPlaceLetters => notInPlaceLetters.includes(letter)
                    )
                    return existsLetterInNotInPlaceLetters
                        ? false
                        : wordWithoutValidLetters.includes(letter)
                })
        })
    }

    private removeWordsWithNotInPlaceIndexes(words: string[]) {
        return words.filter(
            word => !this.notCompletedIndexes.some(
                index => this.notInPlaceLetters.some(
                    notInPlaceItem => notInPlaceItem[index] === word[index]
                )
            )
        )
    }

    private removeInvalidNotInPlaceCombinations(words: string[]) {
        return this.notInPlaceLetters.reduce(
            (wordsRemaining, notInPlace) =>
                wordsRemaining.filter(word => {
                    let isValid = true
                    const splitWord = word.split('')
                    for (let j = 0; j < notInPlace.length; j++) {
                        const letterNotInPlace = notInPlace[j]

                        if (this.isEmpty(letterNotInPlace)) continue
                        if (word[j] === letterNotInPlace) return false

                        isValid &&= splitWord.some((letter, i) => {
                            if (i === j) return false
                            return letter === letterNotInPlace
                        })

                        if (!isValid)
                            return false
                    }
                    return true
                })
            , words)
    }
}