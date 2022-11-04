const fs = require('fs')

console.log(__dirname)
fs.readdir('../src/adapters', (err, files) => {
    if (err)
      console.log(err);
    else {
      console.log("\nCurrent directory filenames:");
      files.forEach(file => {
        console.log(file);
      })
    }
  })