/**
 * Returns the current application time based on the user's manual offset.
 * @param {Object} user - The user object containing time_offset.
 * @returns {Date} The current time adjusted by the offset.
 */
export const applyOffset = (date, user) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (!user || user.time_offset === undefined) return d;
    return new Date(d.getTime() + (user.time_offset * 1000));
};

export const getAppTime = (user) => {
    return applyOffset(new Date(), user);
};

/**
 * Formats a date string or Date object to the user's preferred timezone.
 * @param {Date|string} date - The date to format.
 * @param {string} timezone - The target timezone.
 * @param {string} locale - The locale (e.g., 'de-DE').
 * @returns {string} The formatted time string.
 */
export const formatToUserTime = (date, timezone = 'Europe/Berlin', locale = 'de-DE') => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString(locale, { timeZone: timezone });
};
