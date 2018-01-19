"use strict"

const fs = require("fs")
const fetch = require("node-fetch")

let boards
let board = "g"
let words = []
let interval = 5 * 60 // default 5 minutes between new thread checks
let isUpdatingThreads = false
let downloadMedia = false // images, gifs, webms...
let downloadPosts = true // the JSON content from the API

// For headers
const now = (new Date()).toJSON()
const currentlyWatchingThreads = []
const args = process.argv.slice(2, 12)

for (let a=0; a<args.length; a++) {
    switch (args[a]) {

        case "-board": case "-b":
            board = args[a+1]
            a++
            break

        case "-words": case "-w":
            words = args[a+1].split(",").map(w => w.trim())
            a++
            break

        case "-interval": case "-i":
            interval = parseInt(args[a+1])
            a++
            break

        case "-media": case "-m":
            downloadMedia = args[a+1].toLowerCase() == "y"
            a++
            break

        case "-posts": case "-p":
            downloadPosts = args[a+1].toLowerCase() == "y"
            a++
            break
    }
}

if (!words.length) {
    console.log("\x1b[31mNo words given\x1b[0m")
    return
}

const checkBoard = (board) => {

    const dateTime = new Date().toLocaleString()
    console.log(`${dateTime}\t- Checking /${board}/`)

    fetch(`https://a.4cdn.org/${board}/catalog.json`, {
        headers: {
            "If-Modified-Since" : now
        }
    })
    .then(r => r.json())
    .then(r => {

        // For every page
        for (let p=0; p<r.length; p++) {
            // For every thread
            for (let t=0; t<r[p].threads.length; t++) {

                if (!currentlyWatchingThreads.find(th => th.no==r[p].threads[t].no)) {

                    let match
                    let no = r[p].threads[t].no

                    // For every word
                    wordChecks:
                    for (let w=0; w<words.length; w++) {
                        if ((r[p].threads[t].com && r[p].threads[t].com.toLowerCase().includes(words[w].toLowerCase()))
                         || (r[p].threads[t].sub && r[p].threads[t].sub.toLowerCase().includes(words[w].toLowerCase()))) {

                            currentlyWatchingThreads.push({
                                no: no,
                                op: r[p].threads[t].com
                            })

                            if (currentlyWatchingThreads.length==1 && !isUpdatingThreads) {
                                isUpdatingThreads = true
                                updateThread(0)
                            }

                            match = true
                            break wordChecks
                        }
                    }

                    if (match) {
                        console.log(`${dateTime}\tCurrently watching ${currentlyWatchingThreads.length} threads`)

                        fs.mkdir(`./threads/${board}/${no}`, (err) => {
                            if (err) {
                                if (err.code != "EEXIST") {
                                    console.log(`${dateTime}\t\x1b[33mError creating folder: ${board}-${no}\x1b[0m`, err)
                                }
                            } else {

                                if (downloadPosts) {
                                    fs.writeFile(`./threads/${board}/${no}/${no}.json`, JSON.stringify({op: r[p].threads[t].com}, null, 4), (err) => {
                                        if (err) {
                                            console.log(`${dateTime}\t\x1b[33mError creating file: ${board}/${no}\x1b[0m`, err)
                                        } else {
                                            console.log(`${dateTime}\t\x1b[32mWatching new thread: /${board}/${no}  \x1b[0m`)
                                        }
                                    })
                                }
                            }
                        })
                    }
                }
            }
        }
    })
}


const updateThread = (index) => {

    if (!currentlyWatchingThreads.length) return

    // No more than one request per second
    let timer = 2000
    const dateTime = new Date().toLocaleString()

    if (index==0 && currentlyWatchingThreads.length<1000) {
        timer = 30000
    }

    fetch(`https://a.4cdn.org/${board}/thread/${currentlyWatchingThreads[index].no}.json`, {
        headers: {
            "If-Modified-Since" : now
        }
    }).then(r => r.json())
    .then(r => {

        const no = currentlyWatchingThreads[index].no

        // Update any posts data from the API
        if (downloadPosts) {

            const thread = {
                no: no,
                op: currentlyWatchingThreads[index].op,
                posts: r.posts,
                lastUpdated: (new Date()).toJSON()
            }

            fs.writeFile(`./threads/${board}/${no}/${no}.json`, JSON.stringify(thread, null, 4), (err) => {
                if (err) {
                    console.log(`${dateTime}\t\x1b[33mError updating file: ${board}-${no}\x1b[0m`, err)
                }
            })
        }

        // Download any post images
        if (downloadMedia) {
            for (let p=0; p<r.posts.length; p++) {
                if (r.posts[p].filename) {
                    download(`./threads/${board}/${no}/${r.posts[p].filename}-${r.posts[p].tim}${r.posts[p].ext}`, r.posts[p].tim, r.posts[p].ext, no)
                }
            }
        }

        setTimeout(() => {
            updateThread(++index%currentlyWatchingThreads.length)
        }, timer)

    }).catch(e => {

        // Thread ded
        if (e.type=="invalid-json") {
            currentlyWatchingThreads.splice(index, 1)

            setTimeout(() => {
                updateThread(index)
            }, timer)
        } else {
            console.log(`\x1b[33mError updating thread: ${board}-${currentlyWatchingThreads[index].no}\x1b[0m`, e)
        }
    })
}


const download = (fileName, tim, ext, no) => {
    if (!fs.existsSync(fileName)) {

        console.log(`${new Date().toLocaleString()}\t\x1b[36mDownloading image\x1b[0m: /${board}/${no}/${tim}/${ext}`)

        fetch(`https://i.4cdn.org/${board}/${tim}${ext}`)
        .then(r => r.buffer())
        .then(b => {
            const fileStream = fs.createWriteStream(fileName)
            fileStream.write(b)
            fileStream.end()
        })
    }
}


try {
    fs.mkdirSync("./threads")
} catch (e) {/*Folder already exists*/}

fetch("https://a.4cdn.org/boards.json", {
    headers: {
        "If-Modified-Since" : now
    }
})
.then(r => r.json())
.then(b => {

    boards = b

    const boardWatching = boards.boards.find(b => b.board==board)

    if (!boardWatching) {
        throw new Error(`\x1b[31m\nBoard ${board} not found\x1b[0m`)
    }

    try {
        fs.mkdirSync(`./threads/${board}`)
    } catch (e) {/*Folder already exists*/}

    console.log(`\n\x1b[36mWatching /${board}/ - ${boardWatching.title}...\x1b[0m`)
    checkBoard(board)
    setInterval(() => checkBoard(board), interval*1000)
})