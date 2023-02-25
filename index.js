const glob = require('glob')
const fs = require('fs')
const shell = require('shelljs');

const template = `
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Component Report</title>
    <style>
        html,body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            color: #0a1f44;
        }
        .container {
            width: 1200px;
            margin: 0 auto;
        }
        table {
            width: 100%;
        }
        table,
        td {
            border-top: 1px solid #ccc;
            border-bottom: 1px solid #ccc;
            border-collapse: collapse;
            background: #fafafd;
        }

        td {
            padding: 10px 20px;
        }

        td a {
          white-space: no-wrap;
        }
        
    </style>
</head>

<body>
    <div class="container">
    __PLACEHOLDER__
    </div>
</body>

</html>
`

const getGithubLink = (file, line)=> {
  return `https://github.com/celonis/ems-frontend/blob/main/${file}#L${line}`
}

export function search(args) {
  const component = args[2];
  
  if(!component) {
    throw new Error("Please provide a component name");
  }


  const report = [];

  const g = glob('{,!(node_modules)/**/}*.html', (err, files) => {
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

  function groupByFile() {
    const groupedReport = {};

    report.forEach((item)=> {
      const { file } = item;
      if(groupedReport[file]) {
        groupedReport[file].push(item);
      } else {
        groupedReport[file] = [item];
      }
    });

    return groupedReport;
  }
  
  g.addListener("end", ()=> {
    const groupedReport = groupByFile(report);
    const html = [];
  
    html.push(`<h1>${component}</h1>`);

    html.push(`<p><strong>${component}</strong> component is used in ${report.length} places.</p>`)
  
    html.push("<div class='table-container'>");
    html.push("<table>");
  
    Object.keys(groupedReport).forEach((file)=> {
      const report = groupedReport[file];

      html.push(`<tr><td colspan='2'><strong>${file}</strong></td></tr>`);
      
      report.forEach(({file, line, url})=> {
        html.push("<tr>");
  
        html.push(`<td>Line ${line}</td>`);
        html.push(`<td align="end"><a href="${url}" target="_blank">See File</a></td>`);
    
        html.push("</tr>");
      })
    });
  
    html.push("</table>");
    html.push("</div>");
  
    fs.writeFileSync('report.html', template.replace("__PLACEHOLDER__", html.join("")));

    shell.echo('The report is generated...');
    shell.exec('open ./report.html');
  })
}

