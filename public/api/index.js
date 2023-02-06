
const configurationData = {
    supports_marks: false,
    supports_timescale_marks: false,
    supports_time: true,
    supported_resolutions: [
        '1', '3', '5', '15', '30', '60', '120', '240', '1D', '3D', '1W', '1M'
    ]
};

export default {
    // get a configuration of your datafeed (e.g. supported resolutions, exchanges and so on)
    onReady: (callback) => {
        console.log('[onReady]: Method call');
        setTimeout(() => callback(configurationData)) // callback must be called asynchronously.
    },
    /*
     // NO need if not using search
    searchSymbols: (userInput, exchange, symbolType, onResultReadyCallback) => {
        console.log('[searchSymbols]: Method call');
    },
     */
    // retrieve information about a specific symbol (exchange, price scale, full symbol etc.)
    resolveSymbol: (symbolName, onSymbolResolvedCallback, onResolveErrorCallback) => {
        console.log('[resolveSymbol]: Method call', symbolName);

        const comps = symbolName.split(':')
        symbolName = (comps.length > 1 ? comps[1] : symbolName).toUpperCase()


        // need for pricescale()
        function pricescale(symbol) {
            for (let filter of symbol.filters) {
                if (filter.filterType == 'PRICE_FILTER') {
                    return Math.round(1 / parseFloat(filter.tickSize))
                }
            }
            return 1
        }

        const symbolInfo = (symbol) => ({
            name: symbol.symbol,
            description: symbol.baseAsset + ' / ' + symbol.quoteAsset,
            ticker: symbol.symbol,
            //exchange: 'Binance',
            //listed_exchange: 'Binance',
            //type: 'crypto',
            session: '24x7',
            minmov: 1,
            pricescale: pricescale(symbol), // 	or 100
            timezone: 'UTC',
            has_intraday: true,
            has_daily: true,
            has_weekly_and_monthly: true,
            currency_code: symbol.quoteAsset
        })

        // Get symbols
        getSymbols().then(symbols => {
            const symbol = symbols.find(i => i.symbol == symbolName)
            return symbol ? onSymbolResolvedCallback(symbolInfo(symbol)) : onResolveErrorCallback('[resolveSymbol]: symbol not found')
        })

    },
    // get historical data for the symbol
    // https://github.com/tradingview/charting_library/wiki/JS-Api#getbarssymbolinfo-resolution-periodparams-onhistorycallback-onerrorcallback
    getBars: async (symbolInfo, interval, periodParams, onHistoryCallback, onErrorCallback) => {
        console.log('[getBars] Method call', symbolInfo, interval)

        if (!checkInterval(interval)) {
            return onErrorCallback('[getBars] Invalid interval')
        }

        const klines = await getKlines({ symbol: symbolInfo.name, interval, from: periodParams.from, to: periodParams.to })
        console.log(klines)
        if (klines.length > 0) {
            return onHistoryCallback(klines)
        }

        onErrorCallback('Klines data error')

    },
    // subscription to real-time updates
    subscribeBars: (symbolInfo, interval, onRealtimeCallback, subscribeUID, onResetCacheNeededCallback) => {
        console.log('[subscribeBars]: Method call with subscribeUID:', subscribeUID);

        subscribeKline({ symbol: symbolInfo.name, interval, uniqueID: subscribeUID, }, cb => onRealtimeCallback(cb))
    },
    unsubscribeBars: (subscriberUID) => {
        console.log('[unsubscribeBars]: Method call with subscriberUID:', subscriberUID);
        unsubscribeKline(subscriberUID)
    },
    getServerTime: (callback) => {
        getExchangeServerTime().then(time => {
            callback(Math.floor(time / 1000))
        }).catch(err => {
            console.error(err)
        })
    }
};

//helper.js 

const intervals = {
    '1': '1m',
    '3': '3m',
    '5': '5m',
    '15': '15m',
    '30': '30m',
    '60': '1h',
    '120': '2h',
    '240': '4h',
    '360': '6h',
    '480': '8h',
    '720': '12h',
    'D': '1d',
    '1D': '1d',
    '3D': '3d',
    'W': '1w',
    '1W': '1w',
    'M': '1M',
    '1M': '1M',
}

export const getExchangeServerTime = () => request('/time').then(res => res.serverTime)

export const getSymbols = () => request('/exchangeInfo').then(res => res.symbols)

// https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data
export const getKlines = ({ symbol, interval, from, to }) => {
    interval = intervals[interval] // set interval

    from *= 1000
    to *= 1000

    return request('/klines', { symbol: symbol.toUpperCase(), interval, startTime: from, endTime: to })
        .then(res => {
            return res.map(i => ({
                time: parseFloat(i[0]),
                open: parseFloat(i[1]),
                high: parseFloat(i[2]),
                low: parseFloat(i[3]),
                close: parseFloat(i[4]),
                volume: parseFloat(i[5]),
            }))
        })
}

export const subscribeKline = ({ symbol, interval, uniqueID }, callback) => {
    interval = intervals[interval] // set interval
    return api.stream.kline({ symbol, interval, uniqueID }, res => {
        const candle = formatingKline(res.kline)
        callback(candle)
    })
}

export const unsubscribeKline = (uniqueID) => {
    return api.stream.close.kline({ uniqueID })
}

export const checkInterval = (interval) => !!intervals[interval]

// helpers ------------------------

function formatingKline({ openTime, open, high, low, close, volume }) {
    return {
        time: openTime,
        open,
        high,
        low,
        close,
        volume,
    }
}

function request(url, params = {}) {
    return axios({
        baseURL: 'http://localhost:3000/',
        method: 'get',
        url,
        params
    })
        .then(res => res.data)
        .catch(res => console.log(res))
}

function candle(i) {
    return {
        o: parseFloat(i[1]),
        h: parseFloat(i[2]),
        l: parseFloat(i[3]),
        c: parseFloat(i[4]),
        v: parseFloat(i[5]),
        ts: i[0],
        price: parseFloat(i[4]),
        openTime: i[0],
        closeTime: i[6],
        trades: i[8]
    }
}