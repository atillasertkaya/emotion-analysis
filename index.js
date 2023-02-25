const glob = require('glob')
const fs = require('fs')

const getGithubLink = (file, line)=> {
  return `https://github.com/celonis/ems-frontend/blob/main/${file}#L${line}`
}

const component = process.argv[2];
const report = [];

function search() {
  const g = glob('{,!(node_modules)/**/}*.html', (err, files) => {
    console.log("glob")
    if (err) {
      console.log('Error', err)
    } else {
      files.forEach((file) => {
        let content = fs.readFileSync(file).toString()
        var lines = content.split('\n');
  
        lines.forEach((l, index) => {
          const line = index + 1;
          if (l.indexOf(`<${component}`) > -1) {
            report.push({
              file,
              line,
              url: getGithubLink(file, line)
            });
          }
        });
      })
    }
  })
  
  g.addListener("end", ()=> {
    const template = fs.readFileSync('template.html').toString();
  
    const html = [];
  
    html.push(`<h1>${component}</h1>`);
  
    html.push("<div class='table-container'>");
    html.push("<table>");
  
    report.forEach(({file, line, url})=> {
      html.push("<tr>");
  
      html.push(`<td>${file}</td>`);
      html.push(`<td><a href="${url}" target="_blank">See File</a></td>`);
  
      html.push("</tr>");
    });
  
    html.push("</table>");
    html.push("</div>");
  
    fs.writeFileSync('report.html', template.replace("__PLACEHOLDER__", html.join("")));
  })
}

module.exports = search;