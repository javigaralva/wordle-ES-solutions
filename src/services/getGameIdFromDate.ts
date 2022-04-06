export const WORDLE_START_DATE = new Date( '2022-01-06T04:00:00.000Z' )

export function getGameIdFromDate( date = new Date() ) {
    const start = WORDLE_START_DATE
    const diff = date.getTime() - start.getTime()
    const oneDay = 1000 * 60 * 60 * 24
    return Math.floor( diff / oneDay )
}
