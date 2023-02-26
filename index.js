const glob = require('glob');
const fs = require('fs');
const shell = require('shelljs');
const { match } = require("path-to-regexp");
const { template } = require("./template")

const getGithubLink = (file, line) => `https://github.com/celonis/ems-frontend/blob/main/${file}#L${line}`;

const getCategory = (file) => {
  if(file.indexOf("atoms") > -1) {
    return "Atoms"
  } else if(file.indexOf("molecules") > -1) {
    return "Molecules"
  } else if(file.indexOf("layouts") > -1) {
    return "Layouts"
  } else if(file.indexOf("organisms") > -1) {
    return "Organisms"
  } else if(file.indexOf("editor") > -1) {
    return "Editor"
  }
  return "uncategorised";
}

export function init(args) {
  const command = args[2];
  const param = args[3];

  if (!command) {
    throw new Error("Please provide a command");
  }

  if (command === 'component') {
    search(param);
  } else if (command === 'summary') {
    summary()
  } else {
    throw new Error("command is invalid!");
  }
}

function summary() {
  const globFn = glob('node_modules/@celonis/emotion/**/*.component.d.ts', (err, files) => {

    const fn = match("(.*)/:component.component.d.ts");

    const promises = [];
    const components = [];
    const categories = {};

    files.forEach((file) => {
      const matched = fn(file);
      const component = matched ? matched.params.component : null;
      const category = getCategory(file);

      if (component) {
        categories[component] = category;
        components.push(component);
      }
    });

    const uniqueComponents = Array.from(new Set(components));

    uniqueComponents.forEach((component)=> {
      promises.push(asyncSearch({ category: categories[component], component }));
    });


    Promise.all(promises).then((components) => {
      const html = [];

      html.push("<h1>Emotion Report</h1>");

      html.push("<table>");

      // group
      const groupedReport = {};
      components.forEach(({ category, component, report }) => {
        if(groupedReport[category]) {
          groupedReport[category].push({
            component,
            total: report.length
          })
        } else {
          groupedReport[category] = [{
            component,
            total: report.length
          }];
        }
      });
      
      Object.keys(groupedReport).forEach((category)=> {
        const components = groupedReport[category];

        html.push(`<tr><td colspan='2'><strong>${category}</strong></td></tr>`);

        components.forEach(({ component, total }) => {
          html.push("<tr>");
  
          html.push(`<td>${component}</td>`);
          html.push(`<td align="end">${total}</td>`);
  
          html.push("</tr>");
        });
      });

      html.push("</table>");

      fs.writeFileSync('report.html', template.replace("__PLACEHOLDER__", html.join("")));
  
      shell.echo('The report is generated...');
      shell.exec('open ./report.html');
    });
  });
}

function asyncSearch({ category, component }) {
  return new Promise((resolve, reject) => {
    search(component, (report) => {
      resolve({ category, component, report });
    })
  })
}

function search(component, callback) {
  if (!component) {
    throw new Error("Please provide a component");
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
      const app = matched ? matched.params.app : "uncategorized";

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
    if (typeof callback === 'function') {
      callback(report);
      return;
    }

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
