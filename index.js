const glob = require('glob');
const fs = require('fs');
const shell = require('shelljs');
const { match } = require("path-to-regexp");
const { template } = require("./template")

const getGithubLink = (file, line) => `https://github.com/celonis/ems-frontend/blob/main/${file}#L${line}`

export function search(args) {
  const component = args[2];

  if (!component) {
    throw new Error("Please provide a component name");
  }

  const report = [];

  const globFn = glob('{,!(node_modules)/**/}*.html', (err, files) => {
    if (err) {
      console.log('Error while generating the report!', err);
    } else {
      files.forEach((file) => {
        let content = fs.readFileSync(file).toString();
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

  function groupReport() {
    const groupedReport = {};
    const fn = match("(apps|libs)/:app/(.*)");

    report.forEach((item) => {
      const { file } = item;
      const matched = fn(file);
      const app = matched ? matched.params.app: "uncategorized";

      if (groupedReport[app]) {
        if (groupedReport[app][file]) {
          groupedReport[app][file].push(item);
        } else {
          groupedReport[app][file] = [item];
        }
      } else {
        groupedReport[app] = {
          [file]: [item]
        };
      }
    });

    return groupedReport;
  }

  globFn.addListener("end", () => {
    const groupedReport = groupReport(report);
    const html = [];

    html.push(`<h1>${component}</h1>`);

    const apps = Object.keys(groupedReport);

    html.push(`<p><strong>${component}</strong> component is used in ${apps.length} apps and ${report.length} places.</p>`);

    apps.forEach((app) => {
      const reportByFile = groupedReport[app];
      
      html.push("<details>");

      html.push(`<summary>${app}</summary>`);

      html.push("<table>");

      Object.keys(reportByFile).forEach((file) => {
        const report = reportByFile[file];

        html.push(`<tr><td colspan='2'><strong>${file}</strong></td></tr>`);

        report.forEach(({ line, url }) => {
          html.push("<tr>");

          html.push(`<td>Line ${line}</td>`);
          html.push(`<td align="end"><a href="${url}" target="_blank">See File</a></td>`);

          html.push("</tr>");
        });
      })

      html.push("</table>");

      html.push("</details>");
    });


    fs.writeFileSync('report.html', template.replace("__PLACEHOLDER__", html.join("")));

    shell.echo('The report is generated...');
    shell.exec('open ./report.html');
  })
}
