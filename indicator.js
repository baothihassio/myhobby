

const ta = require('ta.js')
function arrangeResult(result, length) {
    for (i = 0; i < length - 1; i++) {
        result.unshift(0)
    }
    return result;
}

function nz(val) {
    if (!val) {
        return 0
    } else {
        return val
    }
}
function calcFb(high, low) {
    var levels = {};
    var diff = high - low;
    levels['0.0'] = formatPrice(low);
    levels['0.236'] = formatPrice(low + diff * 0.236);
    levels['0.382'] = formatPrice(low + diff * 0.382);
    levels['0.5'] = formatPrice(low + diff * 0.5);
    levels['0.618'] = formatPrice(low + diff * 0.618);
    levels['0.786'] = formatPrice(low + diff * 0.786);
    levels['1.0'] = formatPrice(high);
    return levels;
}
function formatPrice(price) {
    let percision = 6;
    if (price >= 10000) {
        percision = 1
    } else if (price >= 100) {
        percision = 2
    }
    else if (price >= 10) {
        percision = 3
    }
    else if (price >= 1) {
        percision = 4
    } else if (price >= 0.01) {
        percision = 5
    }
    return parseFloat(String(parseFloat(price).toFixed(percision)))
}

function calculateAngle(previous, current) {
    return Math.atan2(current - previous, 1);
}
function calculateATR(data, period) {
    let tr = [];
    for (let i = 0; i < data.length; i++) {
        let current = data[i];
        let prevClose;
        if (i > 0) {
            prevClose = data[i - 1].close;
        } else {
            prevClose = current.close;
        }
        tr.push(Math.max(current.high - current.low, Math.abs(current.high - prevClose), Math.abs(current.low - prevClose)));
    }
    let atr = [];
    for (let i = 0; i < tr.length; i++) {
        if (i < period - 1) {
            atr.push(null);
        } else {
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) {
                sum += tr[j];
            }
            atr.push(sum / period);
        }
    }
    return atr;
}


module.exports = {
    arrangeResult(result, length) {
        for (i = 0; i < length - 1; i++) {
            result.unshift(0)
        }
        return result;
    }
    ,
    detectBBandSqueeze(data) {
        var squeezeStart = -1;
        var squeezeEnd = -1;
        var squeezeDuration = 0;
        for (var i = 0; i < data.length; i++) {
            var upper = data[i].upper;
            var mid = data[i].mid;
            var lower = data[i].lower;
            if (squeezeStart === -1) {
                // Nếu chưa tìm thấy dấu hiệu co lại, kiểm tra xem có phải là dấu hiệu co lại không
                if (upper - lower < (upper - mid) * 0.2) {
                    squeezeStart = i;
                }
            } else {
                // Nếu đã tìm thấy dấu hiệu co lại, kiểm tra xem có còn co lại không
                if (upper - lower > (upper - mid) * 0.2) {
                    squeezeEnd = i;
                    break;
                }
            }
        }
        if (squeezeStart !== -1 && squeezeEnd !== -1) {
            squeezeDuration = squeezeEnd - squeezeStart;
        }
        return {
            squeezeStart: squeezeStart,
            squeezeEnd: squeezeEnd,
            squeezeDuration: squeezeDuration
        };
    },
   

    findRSIDivergence(listSL, listSH, rsiData) {
        let divergences = [];

        for (let i = 0; i < listSL.length; i++) {
            let swingLow = listSL[i];
            let rsiLow = rsiData.find((d) => d.time === swingLow.time);
            if (rsiLow) {
                let rsiLowAngle = calculateAngle(rsiLow.previous, rsiLow.current);
                let priceLowAngle = calculateAngle(swingLow.previous, swingLow.current);
                if (rsiLowAngle > priceLowAngle) {
                    divergences.push({
                        type: "bullish",
                        date: swingLow.date,
                        price: swingLow.current,
                        rsi: rsiLow.current,
                    });
                }
            }
        }

        for (let i = 0; i < listSH.length; i++) {
            let swingHigh = listSH[i];
            let rsiHigh = rsiData.find((d) => d.time === swingHigh.time);

            if (rsiHigh) {
                let rsiHighAngle = calculateAngle(rsiHigh.previous, rsiHigh.current);
                let priceHighAngle = calculateAngle(swingHigh.previous, swingHigh.current);
                if (rsiHighAngle < priceHighAngle) {
                    divergences.push({
                        type: "bearish",
                        date: swingHigh.date,
                        price: swingHigh.current,
                        rsi: rsiHigh.current,
                    });
                }
            }
        }

        return divergences;
    },
    findKeyLevels(combinedList) {
        let keyLevels = [];
        let supportZone = [];
        let resistanceZone = [];
        let lastSupport;
        let lastResistance;

        for (let i = 1; i < combinedList.length - 1; i++) {
            let current = combinedList[i];
            let previous = combinedList[i - 1];
            let next = combinedList[i + 1];

            if (current.current > previous.current && current.current > next.current) {
                if (lastResistance) {
                    if (current.current > lastResistance) {
                        resistanceZone = [];
                        lastResistance = current.current;
                    }
                } else {
                    lastResistance = current.current;
                }
                keyLevels.push({ price: current.current, type: "resistance", date: current.date });
                resistanceZone.push({ price: current.current, date: current.date });
            } else if (current.current < previous.current && current.current < next.current) {
                if (lastSupport) {
                    if (current.current < lastSupport) {
                        supportZone = [];
                        lastSupport = current.current;
                    }
                } else {
                    lastSupport = current.current;
                }
                keyLevels.push({ price: current.current, type: "support", date: current.date });
                supportZone.push({ price: current.current, date: current.date });
            }
        }

        return { keyLevels, supportZone, resistanceZone };
    },
    newfindKeyLevels(data, swingLowPoints, swingHighPoints, period = 14) {
        let keyLevels = [];
        let supportZone = [];
        let resistanceZone = [];
        let atr = calculateATR(data, period);
        let atrThreshold = 2; // adjust this threshold as needed

        for (let i = 0; i < swingLowPoints.length; i++) {
            let currentLow = swingLowPoints[i];
            let currentLowPrice = currentLow.current;
            let currentLowVolume = currentLow.volume;
            let currentLowTime = currentLow.time;
            let isKeyLevel = true;
            // check if there is a swing high point before and after the current low
            // and if the current low is below the previous and next swing high points
            let previousHigh = swingHighPoints.find(p => p.time < currentLowTime);
            let nextHigh = swingHighPoints.find(p => p.time > currentLowTime);
            if (previousHigh && nextHigh) {
                let previousHighPrice = previousHigh.current;
                let nextHighPrice = nextHigh.current;
                if (currentLowPrice >= previousHighPrice || currentLowPrice >= nextHighPrice) {
                    isKeyLevel = false;
                }
            } else {
                isKeyLevel = false;
            }
            // check if the current low is below the last support level + the ATR threshold
            let lastSupport = supportZone[supportZone.length - 1];
            if (lastSupport && currentLowPrice > lastSupport.price + (atr * atrThreshold)) {
                isKeyLevel = false;
            }
            if (isKeyLevel) {
                keyLevels.push({ price: currentLowPrice, type: "support", date: new Date(currentLowTime) });
                supportZone.push({ price: currentLowPrice, date: new Date(currentLowTime) });
            }
        }
        for (let i = 0; i < swingHighPoints.length; i++) {
            let currentHigh = swingHighPoints[i];
            let currentHighPrice = currentHigh.current;
            let currentHighVolume = currentHigh.volume;
            let currentHighTime = currentHigh.time;
            let isKeyLevel = true;
            // check if there is a swing low point before and after the current high
            // and if the current high is above the previous and next swing low points
            let previousLow = swingLowPoints.find(p => p.time < currentHighTime);
            let nextLow = swingLowPoints.find(p => p.time > currentHighTime);
            if (previousLow && nextLow) {
                let previousLowPrice = previousLow.current;
                let nextLowPrice = nextLow.current;
                if (currentHighPrice <= previousLowPrice || currentHighPrice <= nextLowPrice) {
                    isKeyLevel = false;
                }
            } else {
                isKeyLevel = false;
            }
            // check if the current high is above the last resistance level + the ATR threshold
            let lastResistance = resistanceZone[resistanceZone.length - 1];
            if (lastResistance && currentHighPrice < lastResistance.price - (atr * atrThreshold)) {
                isKeyLevel = false;
            }
            if (isKeyLevel) {
                keyLevels.push({ price: currentHighPrice, type: "resistance", date: new Date(currentHighTime) });
                resistanceZone.push({ price: currentHighPrice, date: new Date(currentHighTime) });
            }
        }
        return { keyLevels, supportZone, resistanceZone };
    },
    detectKeyLevels(swingLow, swingHigh, threshold, closePrice, volume) {
        let keyLevels = {
            support: [],
            resistance: []
        };
        for (let i = 0; i < swingLow.length; i++) {
            let sl = swingLow[i];
            let slPrice = closePrice.find(i => i.t === sl.time).c
            let slVolume = volume.find(i => i.t === sl.time).v
            for (let j = i; j < swingHigh.length; j++) {
                let sh = swingHigh[j];
                let shPrice = closePrice.find(i => i.t === sh.time).c
                let shVolume = volume.find(i => i.t === sh.time).v
                if (sl.current < sh.current) {
                    let percent = (shPrice - slPrice) / slPrice * 100;
                    if (percent > threshold) {
                        keyLevels.support.push({
                            price: slPrice,
                            volume: slVolume
                        });
                        keyLevels.resistance.push({
                            price: shPrice,
                            volume: shVolume
                        });
                        i = j;
                        break;
                    }
                }
            }
        }
        return keyLevels;
    }
    ,
    detectStructure(swingLow, swingHigh, volume, ohcl) {
        let structure = []
        for (let i = 1; i < swingLow.length; i++) {
            let currentLow = swingLow[i]
            let prevLow = swingLow[i - 1]
            let currentHigh = swingHigh[i]
            let prevHigh = swingHigh[i - 1]
            let currentVolume = volume[i]
            let prevVolume = volume[i - 1]
            let currentOhcl = ohcl[i]
            let prevOhcl = ohcl[i - 1]
            if (currentLow.price > prevLow.price && currentLow.volume > prevLow.volume && currentLow.volume > currentVolume && currentOhcl.low > prevOhcl.low) {
                structure.push("Break of Support")
            } else if (currentHigh.price < prevHigh.price && currentHigh.volume > prevHigh.volume && currentHigh.volume > currentVolume && currentOhcl.high < prevOhcl.high) {
                structure.push("Break of Resistance")
            } else {
                structure.push("No Break")
            }
        }
        return structure
    },

    detectBoCChoch(swingLow, swingHigh, ohclData, volumeData, threshold) {
        let BoC = [];
        let Choch = [];
        let UOS = []
        for (let i = 1; i < ohclData.length; i++) {
            let currentData = ohclData[i];
            let prevData = ohclData[i - 1];
            let currentVolume = volumeData[i].v;
            let prevVolume = volumeData[i - 1].v;
            if (currentData.c > prevData.c && currentVolume > prevVolume * threshold) {
                BoC.push(i);
            }
            if (currentData.c < prevData.c && currentVolume > prevVolume * threshold) {
                Choch.push(i);
            }
            if (currentData.c > prevData.c && currentVolume < prevVolume * threshold) {
                UOS.push(i);
            }
        }
        return { BoC, Choch, UOS };
    },
    analyzeKeyLevels(_keyLevels, ohcl, threshold = 3) {
        let keyLevels = _keyLevels.keyLevels;

        keyLevels.forEach(level => {
            level.score = 0;
            ohcl.forEach(data => {
                if (level.type === 'support' && data.l <= level.price && level.price <= data.h) {
                    level.score++;
                } else if (level.type === 'resistance' && data.l <= level.price && level.price <= data.h) {
                    level.score++;
                }
            });
        });
        //lấy ra 3 support và 3 resistant có score cao nhất
        let sp = keyLevels.filter(i => i.type === 'support').sort((a, b) => b.score - a.score).slice(0, threshold)
        let res = keyLevels.filter(i => i.type === 'resistance').sort((a, b) => b.score - a.score).slice(0, threshold)

        return { keyLevels, sp, res }
    },
    combineResults(listSL, listSH) {
        let combinedList = listSL.concat(listSH);
        combinedList.sort((a, b) => a.date - b.date);
        return combinedList;
    },
    async getEMA(data, period) {
        let result = await ta.ema(data, period);
        result = arrangeResult(result, period);
        return {
            name: "EMA",
            period: period,
            result
        }
    },
    async getRSI(data, period) {
        let result = await ta.rsi(data, period);
        result = arrangeResult(result, period);

        return {
            name: "RSI",
            period: period,
            result
        }
    },
    async getBB(data, period) {
        var BB = require('technicalindicators').BollingerBands

        var input = {
            period: period,
            values: data,
            stdDev: 2
        }

        let result = BB.calculate(input)
        result = arrangeResult(result, period);
        return {
            name: "BB",
            period: period,
            result
        }
    },

    getCCI(data, period) {
        //input [{open,high,close,low,period}]

        var CCI = require('technicalindicators').CCI;

        var input = {
            period: period,
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            period
        }
        let result = CCI.calculate(input)
        result = arrangeResult(result, period);
        return {
            name: "CCI",
            period: period,
            result
        }

    },

    async getSR(data, symbol) {

        var start = { index: 50, value: 10 }; // default = recent_low(data, 25);
        var support = await ta.support(data, start);
        var current = await support.calculate(data.length - support.index);

        var resistance = await ta.resistance(data, start);

        var current1 = await resistance.calculate(data.length - resistance.index);
        return current;
    },

    supres(low, high, min_touches, stat_likeness_percent, bounce_percent, symbol) {
        let sup = null;
        let res = null;
        let maxima = Math.max(...high);
        let minima = Math.min(...low);

        let move_range = maxima - minima;
        let move_allowance = move_range * (stat_likeness_percent / 100);
        let bounce_distance = move_range * (bounce_percent / 100);

        let touchdown = 0;
        let awaiting_bounce = false;
        for (let x = 0; x < high.length; x++) {
            if (Math.abs(maxima - high[x]) < move_allowance && !awaiting_bounce) {
                touchdown = touchdown + 1;
                awaiting_bounce = true;
            } else if (Math.abs(maxima - high[x]) > bounce_distance) {
                awaiting_bounce = false;
            }
        }
        if (touchdown >= min_touches) {
            res = maxima;
        }

        touchdown = 0;
        awaiting_bounce = false;
        for (let x = 0; x < low.length; x++) {
            if (Math.abs(low[x] - minima) < move_allowance && !awaiting_bounce) {
                touchdown = touchdown + 1;
                awaiting_bounce = true;
            } else if (Math.abs(low[x] - minima) > bounce_distance) {
                awaiting_bounce = false;
            }
        }
        if (touchdown >= min_touches) {
            sup = minima;
        }
        let fibo = calcFb(res, sup);
        return {
            sup: (sup) ? sup : null,
            res: (res) ? res : null,
            fibo: (sup && res) ? fibo : null
        }
    },



    getPrecision(price) {
        let percision = 3;
        let minMove = 0.01
        if (price >= 10000) {
            percision = 1
            minMove = 1000 / 10000
        } else if (price >= 100) {
            percision = 2
            minMove = 100 / 10000
        }
        else if (price >= 10) {
            percision = 3
            minMove = 10 / 10000
        }
        else if (price >= 1) {
            percision = 4
            minMove = 1 / 10000
        } else if (price >= 0.01) {
            percision = 5
            minMove = 0.1 / 10000
        }

        return {
            percision, minMove
        }

    },
    combineResults(listSL, listSH) {
        let combinedList = listSL.concat(listSH);
        combinedList.sort((a, b) => a.date - b.date);
        return combinedList;
    },

    //let listSL = findSL(data, dataTime, dataVolume);
    //let listSH = findSH(data, dataTime, dataVolume);
    //let combinedList = combine
    findKeyLevels(combinedList) {
        let keyLevels = [];
        let supportZone = [];
        let resistanceZone = [];
        let lastSupport;
        let lastResistance;

        for (let i = 1; i < combinedList.length - 1; i++) {
            let current = combinedList[i];
            let previous = combinedList[i - 1];
            let next = combinedList[i + 1];

            if (current.current > previous.current && current.current > next.current) {
                if (lastResistance) {
                    if (current.current > lastResistance) {
                        resistanceZone = [];
                        lastResistance = current.current;
                    }
                } else {
                    lastResistance = current.current;
                }
                keyLevels.push({ price: current.current, type: "resistance", date: current.date });
                resistanceZone.push({ price: current.current, date: current.date });
            } else if (current.current < previous.current && current.current < next.current) {
                if (lastSupport) {
                    if (current.current < lastSupport) {
                        supportZone = [];
                        lastSupport = current.current;
                    }
                } else {
                    lastSupport = current.current;
                }
                keyLevels.push({ price: current.current, type: "support", date: current.date });
                supportZone.push({ price: current.current, date: current.date });
            }
        }

        return { keyLevels, supportZone, resistanceZone };
    },

    // findSH(data, dataTime, dataVolume, periodBack = 2, periodNext = 2) {
    //     //find swing low
    //     // là tập hợp 5 cây nến trong đó cây nến hiện tại giá thấp hơn 2 cây trước và 2 cây sau, và volume điểm đó cao hơn 
    //     let listSW = []
    //     for (let i = periodBack; i < data.length - periodNext; i++) {

    //         let current = data[i]
    //         let volumeC = dataVolume[i]
    //         let pass_1 = data[i - 1]
    //         let volume_p1 = dataVolume[i - 1]
    //         let pass_2 = data[i - 2]
    //         let volume_p2 = dataVolume[i - 2]

    //         let next_1 = data[i + 1]
    //         let volume_n1 = dataVolume[i + 1]
    //         let next_2 = data[i + 2]
    //         let volume_n2 = dataVolume[i + 2]

    //         if (current > pass_1 && current > pass_2 && current > next_1
    //             && current > next_2 && pass_1 > pass_2 && next_1 > next_2
    //             //  && volumeC > volume_p1 && volumeC > volume_p2 && volume_p1 > volume_p2
    //             // && volumeC > volume_n1 && volumeC > volume_n1 && volume_n1 > volume_n2

    //         ) {
    //             listSW.push({ time: dataTime[i], pass_2, pass_1, current, next_1, next_2, date: new Date(dataTime[i]) })
    //         }
    //     }
    //     return listSW;
    // },
    //find SL OpenAO

    findRSIDivergence(listSL, listSH, rsiData) {
        let divergences = [];

        for (let i = 0; i < listSL.length; i++) {
            let swingLow = listSL[i];
            let rsiLow = rsiData.find((d) => d.time === swingLow.time);

            if (rsiLow) {
                let rsiLowAngle = calculateAngle(rsiLow.previous, rsiLow.current);
                let priceLowAngle = calculateAngle(swingLow.previous, swingLow.current);
                if (rsiLowAngle > priceLowAngle) {
                    divergences.push({
                        type: "bullish",
                        date: swingLow.date,
                        price: swingLow.current,
                        rsi: rsiLow.current,
                    });
                }
            }
        }

        for (let i = 0; i < listSH.length; i++) {
            let swingHigh = listSH[i];
            let rsiHigh = rsiData.find((d) => d.time === swingHigh.time);

            if (rsiHigh) {
                let rsiHighAngle = calculateAngle(rsiHigh.previous, rsiHigh.current);
                let priceHighAngle = calculateAngle(swingHigh.previous, swingHigh.current);
                if (rsiHighAngle < priceHighAngle) {
                    divergences.push({
                        type: "bearish",
                        date: swingHigh.date,
                        price: swingHigh.current,
                        rsi: rsiHigh.current,
                    });
                }
            }
        }

        return divergences;
    },

    calculateAngle(previous, current) {
        return Math.atan2(current - previous, 1);
    },
    //findSL,SH version openAI
    findSL(data, dataTime, dataVolume, periodBack = 2, periodNext = 2) {
        let listSW = []
        for (let i = periodBack; i < data.length - periodNext; i++) {
            let current = data[i];
            let volumeC = dataVolume[i];

            let isLow = true;
            for (let j = i - periodBack; j <= i + periodNext; j++) {
                if (j === i) continue;
                if (data[j] <= current) {
                    isLow = false;
                    break;
                }
            }

            if (isLow && volumeC > dataVolume[i - periodBack] && volumeC > dataVolume[i + periodNext]) {
                listSW.push({ type: "swingHigh", time: dataTime[i], current, date: new Date(dataTime[i]) });
            }
        }
        return listSW;
    },
    findSH(data, dataTime, dataVolume, periodBack = 2, periodNext = 2) {
        let listSH = [];
        for (let i = periodBack; i < data.length - periodNext; i++) {
            let current = data[i];
            let volumeC = dataVolume[i];

            let isHigh = true;
            for (let j = i - periodBack; j <= i + periodNext; j++) {
                if (j === i) continue;
                if (data[j] >= current) {
                    isHigh = false;
                    break;
                }
            }

            if (isHigh && volumeC > dataVolume[i - periodBack] && volumeC > dataVolume[i + periodNext]) {
                listSH.push({ type: "swingHigh", time: dataTime[i], current, date: new Date(dataTime[i]) });
            }
        }
        return listSH;
    },
    // findSL(data, dataTime, dataVolume, periodBack = 2, periodNext = 2) {
    //     //find swing low
    //     // là tập hợp 5 cây nến trong đó cây nến hiện tại giá thấp hơn 2 cây trước và 2 cây sau, và volume điểm đó cao hơn 
    //     let listSW = []
    //     for (let i = periodBack; i < data.length - periodNext; i++) {
    //         let current = data[i]
    //         let volumeC = dataVolume[i]
    //         let pass_1 = data[i - 1]
    //         let volume_p1 = dataVolume[i - 1]
    //         let pass_2 = data[i - 2]
    //         let volume_p2 = dataVolume[i - 2]


    //         let next_1 = data[i + 1]
    //         let volume_n1 = dataVolume[i + 1]
    //         let next_2 = data[i + 2]
    //         let volume_n2 = dataVolume[i + 2]

    //         if (current < pass_1 && current < pass_2 && current < next_1
    //             && current < next_2 && pass_1 < pass_2 && next_1 < next_2
    //             //    && volumeC > volume_p1 && volumeC > volume_p2 && volume_p1 > volume_p2
    //             //   && volumeC > volume_n1 && volumeC > volume_n1 && volume_n1 > volume_n2

    //         ) {
    //             listSW.push({ time: dataTime[i], pass_2, pass_1, current, next_1, next_2, date: new Date(dataTime[i]) })
    //         }
    //     }
    //     return listSW;
    // },
    getMyBot(data, period, multi, dataTime) {

        const EMA = require('technicalindicators').EMA
        let ema14 = EMA.calculate({ period, values: data })
        let t2 = Array(ema14.length)
        for (let i = 1; i < ema14.length - 1; i++) {
            let t1 = ema14[i]
            let sl = t1 * (multi / 100)
            let iff1 = (t1 > nz(t2[i - 1])) ? t1 - sl : t1 + sl
            let iff2 = (t1 < nz(t2[i - 1]) && ema14[i - 1] < nz(t2[i - 1])) ? Math.min(nz(t2[i - 1]), t1 + sl) : iff1
            let iff3 = (t1 > nz(t2[i - 1]) && ema14[i - 1] > nz(t2[i - 1])) ? Math.max(nz(t2[i - 1]), t1 - sl) : iff2
            t2[i] = iff3
        }
        let t1 = ema14;
        for (let i = 0; i < period - 1; i++) {
            t2[i] = 0;
            t1.unshift(0)
            t2.unshift(0)
        }
        let lastSignal = "LONG";
        if ((t1[t1.length - 1] > t2[t2.length - 2])) {
            lastSignal = "LONG";
        } else {
            lastSignal = "SHORT";
        }
        let breakPoint = 0;
        for (let i = t1.length - 1; i > 0; i--) {
            let item_t1 = t1[i];
            let item_t2 = t2[i - 1];

            if (item_t1 > item_t2 && t1[i - 1] < t2[i - 2]) {
                breakPoint = i
                break;
            }
        }
        let signalCountBar = t1.length - breakPoint;

        return {
            name: "mybot",
            period: period,
            result: {
                t1,
                t2,
                lastSignal,
                signalBegin: breakPoint,
                signalCountBar,
                signalAt: (dataTime[breakPoint + 1])
            }
        }
    },

    detectTrend(listSL, listSH, keyLevels, volumeData) {
        let trend = "sideways";
        let lastSwingLow = listSL[0];
        let lastSwingHigh = listSH[0];
        let lastSupport = keyLevels.filter((k) => k.type === "support").sort((a, b) => b.price - a.price)[0];
        let lastResistance = keyLevels.filter((k) => k.type === "resistance").sort((a, b) => a.price - b.price)[0];
        for (let i = 1; i < listSL.length; i++) {
            let currentSwingLow = listSL[i];
            let currentSwingHigh = listSH[i];
            let currentSupport = keyLevels.filter((k) => k.type === "support" && k.date < currentSwingLow.date).sort((a, b) => b.price - a.price)[0];
            let currentResistance = keyLevels.filter((k) => k.type === "resistance" && k.date < currentSwingHigh.date).sort((a, b) => a.price - b.price)[0];
            let currentVolume = volumeData.find((v) => v.time === currentSwingLow.time || v.time === currentSwingHigh.time);

            if (currentSwingLow.current > lastSwingLow.current && currentSwingHigh.current > lastSwingHigh.current) {
                trend = "bullish";
                if (currentSupport && currentSupport.price < lastSupport.price) {
                    trend = "sideways";
                }
                if (currentResistance && currentResistance.price > lastResistance.price) {
                    trend = "sideways";
                }
            } else if (currentSwingLow.current < lastSwingLow.current && currentSwingHigh.current < lastSwingHigh.current) {
                trend = "bearish";
                if (currentSupport && currentSupport.price > lastSupport.price) {
                    trend = "sideways";
                } else if (currentSwingLow.current < lastSwingLow.current && currentSwingHigh.current < lastSwingHigh.current) {
                    trend = "bearish";
                    if (currentSupport && currentSupport.price > lastSupport.price) {
                        trend = "sideways";
                    }
                    if (currentResistance && currentResistance.price < lastResistance.price) {
                        trend = "sideways";
                    }
                }

                if (currentVolume) {
                    if (trend === "bullish" && currentVolume.volume < lastVolume.volume) {
                        trend = "sideways";
                    } else if (trend === "bearish" && currentVolume.volume > lastVolume.volume) {
                        trend = "sideways";
                    }
                }

                lastSwingLow = currentSwingLow;
                lastSwingHigh = currentSwingHigh;
                lastSupport = currentSupport;
                lastResistance = currentResistance;
                lastVolume = currentVolume;
            }

            return trend;
        }
    },
    assertTrend(trend, listSL, listSH, keyLevels, volumeData, rsiData, macdData, candleStickData) {
        let trendAssertion = trend;

        // Check for moving average crossover
        let movingAverage50 = calculateMovingAverage(50, priceData);
        let movingAverage200 = calculateMovingAverage(200, priceData);
        if (movingAverage50 > movingAverage200 && trend !== "bullish") {
            trendAssertion = "sideways";
        } else if (movingAverage50 < movingAverage200 && trend !== "bearish") {
            trendAssertion = "sideways";
        }

        // Check for RSI divergence
        let rsiDivergences = findRSIDivergence(listSL, listSH, rsiData);
        if (rsiDivergences.length > 0) {
            let lastDivergence = rsiDivergences[rsiDivergences.length - 1];
            if (lastDivergence.type === "bullish" && trend !== "bullish") {
                trendAssertion = "sideways";
            } else if (lastDivergence.type === "bearish" && trend !== "bearish") {
                trendAssertion = "sideways";
            }
        }

        // Check for MACD crossover
        let macdCrossover = checkMACDCrossover(macdData);
        if (macdCrossover === "bullish" && trend !== "bullish") {
            trendAssertion = "sideways";
        } else if (macdCrossover === "bearish" && trend !== "bearish") {
            trendAssertion = "sideways";
        }

        // Check for bearish candlestick patterns
        let bearishCandles = findBearishCandles(candleStickData);
        if (bearishCandles.length > 0) {
            let lastBearishCandle = bearishCandles[bearishCandles.length - 1];
            if (lastBearishCandle.date > trendStartDate && trend !== "bearish") {
                trendAssertion = "sideways";
            }
        }

        // Check for bullish candlestick patterns
        let bullishCandles = findBullishCandles(candleStickData);
        if (bullishCandles.length > 0) {
            let lastBullishCandle = bullishCandles[bullishCandles.length - 1];
            if (lastBullishCandle.date > trendStartDate && trend !== "bullish") {
                trendAssertion = "sideways";
            }
        }

        return trendAssertion;
    },
    calcTrailingStopLoss(priceData, stopLoss, trailingPercent) {
        let currentPrice = priceData[priceData.length - 1];
        let trailingStopLoss = currentPrice - (currentPrice - stopLoss) * (trailingPercent / 100);
        return trailingStopLoss;
    }
}
