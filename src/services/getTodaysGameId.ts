import { WordleType } from '../defs'
import { getGameIdFromDate } from './getGameIdFromDate'

export function getTodaysGameId( wordleType: WordleType ) {
    return getGameIdFromDate( wordleType )
}


