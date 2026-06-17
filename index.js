const path = require('path')
const cors = require('cors')
const express = require('express')

const app = express()
const PORT = process.env.PORT || 12315

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`)
    next()
})

app.use(cors())

app.all('/', (req, res) => {
    res.send('https://github.com/anosu/dotabyss-translation')
})

Array.from(['manifest', 'names', 'titles', 'descriptions', 'another_name', 'novels']).forEach(cls => {
    app.get(`/${cls}/*`, (req, res) => {
        const filePath = path.join(__dirname, 'translations', `${cls}/${req.params[0]}`)
        res.sendFile(filePath, err => err && res.sendStatus(404))
    })
})

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)
})
