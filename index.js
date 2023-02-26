const glob = require('glob');
const fs = require('fs-extra');
const shell = require('shelljs');
const { match } = require("path-to-regexp");
const { template } = require("./template");
var Spinner = require('cli-spinner').Spinner;

const getGithubLink = (file, line) => `https://github.com/celonis/ems-frontend/blob/main/${file}#L${line}`;

const getCategory = (file) => {
  if (file.indexOf("atoms") > -1) {
    return "Atoms"
  } else if (file.indexOf("molecules") > -1) {
    return "Molecules"
  } else if (file.indexOf("layouts") > -1) {
    return "Layouts"
  } else if (file.indexOf("organisms") > -1) {
    return "Organisms"
  } else if (file.indexOf("editor") > -1) {
    return "Editor"
  }
  return "uncategorised";
}

const getFile = (filename) => `emotion-report/${filename}`;

const startLoading = () => (new Spinner('your report is being generated')).start();

const getNameFromSlug = (slug) => {
  var words = slug.split("-");
  return words.map(function(word) {
    return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
  }).join(' ');
}

export function init(args) {
  const command = args[2];
  const param = args[3];

  if (!command) {
    shell.echo("Please provide a command!");
    return;
  }

  fs.emptyDir("emotion-report").then(() => {
    if (command === 'component') {
      search(param);
    } else if (command === 'summary') {
      summary()
    } else {
      shell.echo("command is invalid!");
    }
  });
}

function summary() {
  const loading = startLoading();

  const globFn = glob('node_modules/@celonis/emotion/**/*.component.d.ts', (error, files) => {

    if (error) {
      loading.stop(true);
      shell.echo("Error while generating the report!", error);
      return;
    }

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

    uniqueComponents.forEach((component) => {
      promises.push(asyncSearch({ category: categories[component], component }));
    });


    Promise.all(promises).then((components) => {
      const html = [];

      html.push("<h1>Emotion Report</h1>");

      html.push("<table>");

      // group
      const groupedReport = {};
      components.forEach(({ category, component, report }) => {
        if (groupedReport[category]) {
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

      Object.keys(groupedReport).forEach((category) => {
        const components = groupedReport[category];

        html.push(`<tr><td colspan='2'><strong>${category}</strong></td></tr>`);

        components.forEach(({ component, total }) => {
          html.push("<tr>");

          html.push(`<td><a href="${`${category}/${component}.html`}">${component}</a></td>`);
          html.push(`<td align="end">${total}</td>`);

          html.push("</tr>");
        });
      });

      html.push("</table>");

      const reportFile = getFile('report.html');

      loading.stop(true);

      fs.outputFile(reportFile, template.replace("__PLACEHOLDER__", html.join(""))).then(() => {
        shell.echo('The report is generated...');
        shell.exec(`open ${reportFile}`);
      });

    });
  });
}

function asyncSearch({ category, component }) {
  return new Promise((resolve, reject) => {
    search(component, (report, html = []) => {
      const reportFile = getFile(`${category}/${component}.html`);
      fs.outputFile(reportFile, template.replace("__PLACEHOLDER__", html.join(""))).then(() => {
        resolve({ category, component, report });
      });
    })
  })
}

function search(component, callback) {
  if (!component) {
    shell.echo("Please provide a component");
    return;
  }

  const loading = startLoading();

  const report = [];

  const globFn = glob('{,!(node_modules)/**/}*.html', (error, files) => {
    if (error) {
      loading.stop();
      shell.echo("Error while generating the report!", error);
      return;
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
    const groupedReport = groupReport(report);
    const html = [];

    html.push(`<h1>${component}</h1>`);

    const apps = Object.keys(groupedReport);

    html.push(`<p><strong>${component}</strong> component is used in ${apps.length} apps and ${report.length} places.</p>`);

    apps.forEach((app) => {
      const reportByFile = groupedReport[app];

      html.push("<details>");

      html.push(`<summary>${getNameFromSlug(app)}</summary>`);

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

    if (typeof callback === 'function') {
      callback(report, html);
      return;
    }

    const reportFile = getFile(`${component}.html`);

    loading.stop(true);

    fs.outputFile(reportFile, template.replace("__PLACEHOLDER__", html.join(""))).then(() => {
      shell.echo('The report is generated...');
      shell.exec(`open ${reportFile}`);
    });

  })
}
