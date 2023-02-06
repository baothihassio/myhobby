const express = require('express');

const delay = require('delay')
const bodyParser = require('body-parser');
const Binance = require('node-binance-api');
const binance = new Binance({
    recvWindow: 60000, // Set a higher recvWindow to increase response timeout
})
const compression = require('compression');
const uri = "mongodb+srv://bao2:123@cluster0.3s16wqd.mongodb.net/future?retryWrites=true&w=majority";
const mongoose = require('mongoose');
mongoose.set("strictQuery", false);
mongoose.connect(uri);

var DotJson = require('dot-json');
var myConfig = new DotJson('config.json');


const lastDataModel = mongoose.model('lastData', { name: String, timeframe: String, data: String });

const scanResult = mongoose.model('scanResult', { name: String, timeframe: String, data: String });

const { App, Deta } = require('deta');

// add your Project Key
const deta = Deta("c06pa3r8_E3wFBRJ7mEMFDP7UorXyrzBLPvREjSCR")
// name your DB

//const app = App(express());
const app = express();

var timeframe = null
var timeout = null
app.use(express.static('public'))
app.use(compression())
app.set("view engine", "ejs");
app.set("views", "./views");
app.get('/', async (req, res) => {

    res.send({ hello: 'world' })
});
app.get('/addlistsymbol', async (req, res) => {
    const db = deta.Base("listSymbol")
    let symbolName = req.query.symbol;
    await db.put({
        name: symbolName
    })
    res.send('ok')
})
app.get('/setListSymbol')
app.get('/getlistsymbol', async (req, res) => {
    const db = deta.Base("listSymbol")
    const { items } = await db.fetch()
    res.send(JSON.stringify(items))
})
app.get('/getConfig', async (req, res) => {
    let timeframe = await myConfig.get("timeframe");
    let timeout = await myConfig.get("timeout");
    res.send({ timeframe, timeout })
})
app.get('/saveConfig', async (req, res) => {
    let { timeframe, timeout } = req.query;
    await myConfig.set("timeframe", timeframe).set("timeout", parseFloat(timeout)).save();
    timeframe = timeframe;
    timeout = parseFloat(timeout)
    console.log('config change')
    res.send('ok')
})
app.get('/listSymbol', async (req, res) => {
    const db = deta.Base("listSymbol")
    res.render('listsymbol')
})

//getData("BTCUSDT", "1h")
async function start() {
    timeframe = await myConfig.get("timeframe");
    timeout = await myConfig.get("timeout");

    console.log('====start at', new Date())
    console.log(`Loading config :${timeframe},timeout:${timeout}`)
    timeframe = timeframe;
    timeout = timeout;
    if (timeframe && timeout) {
        await main();
        await delay(timeout * 1000)
        start();
    }
}
start();
var listLastData = [];
var util = require('./indicator');
async function main() {
    //get list symbol support
    return new Promise(async (resolve, reject) => {
        const db = deta.Base("listSymbol")
        const { items } = await db.fetch()
        let TokenList = []
        items.forEach(i => {
            TokenList.push(handleData(i.name, timeframe));
        })
        Promise.all(TokenList).then(async (data) => {
            console.log('begin')
            let listInsert = []
            for (let i = 0; i < data.length; i++) {
                let sym = data[i];
                let _timeframe = sym.time;
                if (sym && sym.symbol) {
                    let filter = { name: sym.symbol, timeframe: _timeframe }
                    let dataToUpdate = { data: JSON.stringify(sym.lastData) }
                    let options = { upsert: true, new: true, setDefaultsOnInsert: true };
                    let action = lastDataModel.findOneAndUpdate(filter, dataToUpdate, options, null)
                    listInsert.push(action)
                    //scan raw
                    let dataToUpdateRaw = { data: JSON.stringify(sym.data.result) }
                    let actionRaw = scanResult.findOneAndUpdate(filter, dataToUpdateRaw, options, null)
                    listInsert.push(actionRaw)

                }
            }
            Promise.all(listInsert).then(data => {
                let strLog = []
                data.map(item => {
                    strLog.push({ name: item.name, timeframe: item.timeframe, action: 'Insert', log: 'success' })
                })
                console.table(strLog)
                resolve('ok')
            })
        })
    })

}

async function getIndicators(ticks, symbol, timeframe) {
    return new Promise(async (resolve, reject) => {
        //ta.js, data = []
        let dataClose = []
        let dataCloseVolume = []
        let dataLow = []
        let dataHigh = []
        let dataVolume = []
        let dataOHCL = []
        //technical analizec
        let ta_high = []
        let ta_low = []
        let ta_close = []
        let ta_open = []
        let ta_high_close_low = []
        let dataForOpenAI = [];//close,high to object
        ticks.ticks.map(i => {
            let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = i;
            //ta.js
            dataOHCL.push({
                o: parseFloat(open),
                h: parseFloat(high),
                c: parseFloat(close),
                l: parseFloat(low),
                t: parseFloat(time),
                v: parseFloat(volume)
            })
            dataHigh.push(parseFloat(high))
            dataLow.push(parseFloat(low))
            dataClose.push(parseFloat(close))
            dataCloseVolume.push(parseFloat(time))
            dataVolume.push(parseFloat(volume))
            //techincal analize
            ta_high.push(parseFloat(high))
            ta_low.push(parseFloat(low))
            ta_open.push(parseFloat(open))
            ta_close.push(parseFloat(close))
            ta_high_close_low.push([parseFloat(high), parseFloat(close), parseFloat(low)])
            //data object
            dataForOpenAI.push({
                open: parseFloat(open),
                high: parseFloat(high),
                close: parseFloat(close),
                low: parseFloat(low),
            })
        })
        let ema = await util.getEMA(dataClose, 14)
        let ema21 = await util.getEMA(dataClose, 21)
        let ema34 = await util.getEMA(dataClose, 34)
        let ema50 = await util.getEMA(dataClose, 50)
        let ema89 = await util.getEMA(dataClose, 89)
        let ema200 = await util.getEMA(dataClose, 200)
        let rsi = await util.getRSI(dataClose, 14)
        let bb = await util.getBB(dataClose, 20)
        let cci = util.getCCI({ high: ta_high, close: ta_close, low: ta_open, open: ta_open }, 20)
        let mybot89 = util.getMyBot(dataClose, 89, 2, dataCloseVolume);
        let mybot34 = util.getMyBot(dataClose, 34, 2, dataCloseVolume);
        let mybot14 = util.getMyBot(dataClose, 14, 2, dataCloseVolume);
        let newDataframe = []

        //check cross of t1,t2
        //count singal LONG or SHORT
        for (let i = 0; i < ticks.ticks.length; i++) {
            // time: '2018-12-22', open: 75.16, high: 82.84, low: 36.16, close: 45.72
            let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = ticks.ticks[i]

            newDataframe.push({

                open: parseFloat(open),
                high: parseFloat(high),
                close: parseFloat(close),
                low: parseFloat(low),
                time: (parseFloat(time) + 25200000),
                volume: parseFloat(volume),
                ema14: ema.result[i],
                ema21: ema21.result[i],
                ema34: ema34.result[i],
                ema50: ema50.result[i],
                ema89: ema89.result[i],
                ema200: ema200.result[i],
                rsi: rsi.result[i],
                cci: cci.result[i],
                mybot14: { t1: mybot14.result.t1[i], t2: mybot14.result.t2[i], lastSignal: mybot14.result.lastSignal, signalBegin: mybot14.result.signalBegin, signalCountBar: mybot14.result.signalCountBar, signalAt: mybot14.result.signalAt },
                mybot89: { t1: mybot89.result.t1[i], t2: mybot89.result.t2[i], lastSignal: mybot89.result.lastSignal, signalBegin: mybot89.result.signalBegin, signalCountBar: mybot89.result.signalCountBar, signalAt: mybot89.result.signalAt },
                mybot34: { t1: mybot34.result.t1[i], t2: mybot34.result.t2[i], lastSignal: mybot89.result.lastSignal, signalBegin: mybot34.result.signalBegin, signalCountBar: mybot34.result.signalCountBar, signalAt: mybot34.result.signalAt },
                bb: bb.result[i],

            })
        }
        //write to db
        listLastData.push({
            name: symbol, lastData: newDataframe[newDataframe.length - 1], timeframe
        })
        resolve({ name: symbol, result: newDataframe, timeframe, lastData: newDataframe[newDataframe.length - 2] })
    })
}
async function handleData(symbol, time) {
    return new Promise(async (resolve, reject) => {
        let data = await getData(symbol, time);
        if (data) {
            let dataAfter = await getIndicators(data, symbol, time);
            resolve({ symbol, time, data: dataAfter, lastData: dataAfter.lastData })
        } else {
            console.error("Error at", symbol)
            resolve(null)
        }

    })
    //calc and push to db
}
async function getData(symbol, time) {
    return new Promise((resolve, reject) => {
        try {
            binance.candlesticks(symbol, time, (error, ticks, symbol) => {
                if (error) {
                    // console.log(error)
                    reject(error)
                } else {
                    if (ticks) {
                        let lastClose = []
                        ticks.forEach(i => {
                            let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = i;
                            lastClose.push(close)
                        })
                        let last_tick = ticks[ticks.length - 1]
                        resolve({
                            "name": symbol,
                            "time": time,
                            "last_tick": last_tick,
                            "ticks": [...ticks]
                        })
                    } else {
                        resolve(null)
                        reject(error)
                    }

                }
            }, { limit: 1000 })
        }
        catch (err) {
            console.log(err)
            console.log('**** fetch error - limit IP')
            // console.log(err)
            reject(err)
        }

    }).catch((err) => {
        // console.log(err)
    });
}
app.listen(3000)
module.exports = app;

/*

*/