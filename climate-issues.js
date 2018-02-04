const https = require('https');
const { URL } = require('url');

var REPO = null
var GIT_COMMIT = process.argv[2]
var REPO_NAME = process.argv[3]
var TOKEN = process.argv[4]

console.log('GIT COMMIT:', GIT_COMMIT)
console.log('REPO NAME:', REPO_NAME)

function debug_log(o) {
  //console.log('DEBUG:',o)
}

function climate_api(path, success) {
  options = {
    hostname: 'api.codeclimate.com',
    port: 443,
    path: REPO ? `/v1/repos/${REPO}${path}` : `/v1/repos?github_slug=${path}`,
    method: 'GET',
    headers: {'Authorization': `Token ${TOKEN}`}
  }
  debug_log(`Climate ${path} ...`)

  const req = https.request(options, (res) => {
    var data='';
    //console.dir(res)
    //debug_log('statusCode:', res.statusCode);
    //console.log('headers:', res.headers);
    res.on('data', (chunk) => { data += chunk })
    res.on('end', () => { 
      var parsed_data = null
      try {
        parsed_data = JSON.parse(data) 
      }
      catch (e) {
        console.error(e)
      }
      if (parsed_data) success(parsed_data)
    })
  })
  req.on('error', (e) => { console.error(e) })
  req.end();
}

function get_issues(snapshot) {
  climate_api(`/snapshots/${snapshot}/issues?filter[severity]=critical`, (issues) => {
    debug_log(issues)
    issues.data = issues.data.filter( (issue) => {
      //issue.attributes.categories "Security"
      //issue.attributes.severity      "critical"
      return ! (issue.attributes.status && issue.attributes.status.name.match(/invalid|wontfix/))
    })
    issues.data.forEach( (issue) => {
      console.log(issue.attributes)
      console.log('------------------------------')
    })
    if (issues.data.length > 0) process.exit(1)
  })
}

function get_snapshot(commit, callback) {
  climate_api('/builds', (builds) => {
    debug_log(builds)
    console.log(`found ${builds.data.length} builds`)
    var found_commit = null
    builds.data.forEach( (build) => {
      debug_log(build)
      if (build.attributes.commit_sha == commit) {
        found_commit = build
        if (!build.relationships.snapshot.data) {
          console.error(`climate snapshot for ${commit} not found. not ready yet?`)
          process.exit(0)
        }
        debug_log(`${commit} -> ${build.relationships.snapshot.data.id}`)
        callback(build.relationships.snapshot.data.id)
      }
    })
    if (!found_commit) {
      console.error(`climate build for ${commit} not found. not in git?`)
    }
  })
}

function find_issues(repo_name, commit) {
  climate_api(repo_name,(repos)=>{
    REPO = repos.data[0].id
    console.log('CLIMATE REPO ID:', REPO)
    get_snapshot(commit, get_issues)
  })
}

find_issues(REPO_NAME, GIT_COMMIT)

