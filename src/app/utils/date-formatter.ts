import * as moment from 'moment-timezone';
import { DATE_FORMATS } from '../constants/date-formats';

export const formatDateWithTimezone = (
  date: number | string | Date,
  timezone: string,
  format: string = DATE_FORMATS.DATETIME_WITH_TIMEZONE,
): string => {
  if (typeof date === 'number') {
    return moment(date).tz(timezone).format(format);
  }

  return moment(date).tz(timezone).format(format);
};
