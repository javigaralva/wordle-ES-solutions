import { WordleType } from "./defs"

const WORDLE_START_DATE = {
    NORMAL  : new Date( '2022-01-06T04:00:00.000Z' ),
    ACCENT  : new Date( '2022-02-28T04:00:00.000Z' ),
    SCIENCE : new Date( '2022-03-13T04:00:00.000Z' ),
}
export function getGameIdFromDate( wordleType: WordleType, date = new Date() ) {
    const start = WORDLE_START_DATE[ wordleType ]
    const diff = date.getTime() - start.getTime()
    const oneDay = 1000 * 60 * 60 * 24
    return Math.floor( diff / oneDay )
}
