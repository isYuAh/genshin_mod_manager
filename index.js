import express from 'express';
import * as fs from "fs";
import * as path from "path";
import cors from 'cors'
import {exec, execSync} from "child_process"
const app = express()
const port = 7777
let MODS = {};
let FIXES = {};
let TAGS = {};

function CheckModInfo(obj, f, path) {
  let sign = false;
  if (!obj.dir || obj.dir !== f.name) {
    sign = true;
    obj.dir = f.name
  }
  if (!obj.name) {
    sign = true;
    obj.name = f.name
  }
  if (obj.tags === undefined) {
    sign = true;
    obj.tags = []
  }
  if (sign) {
    fs.writeFileSync(`${path}/${f.name}.json`, JSON.stringify(obj))
  }
}
function CheckFixInfo(obj, f, path) {
  let sign = false;
  if (!obj.dir || obj.dir !== f.name) {
    sign = true;
    obj.dir = f.name
  }
  if (!obj.name) {
    sign = true;
    obj.name = f.name
  }
  if (sign) {
    fs.writeFileSync(`${path}/${f.name}.json`, JSON.stringify(obj))
  }
}
function SearchMods(path, disabled) {
  let files = fs.readdirSync(path, {withFileTypes: true})
  for (let f of files) {
    if (f.isDirectory()) {
      let mod = {};
      if (fs.existsSync(`${path}/${f.name}.json`)) {
        mod = JSON.parse(fs.readFileSync(`${path}/${f.name}.json`).toString())
        mod.disabled = disabled
        CheckModInfo(mod, f, path)
      }else {
        mod = {
          name: f.name,
          dir: f.name,
          tags: [],
          disabled: disabled,
        }
        fs.writeFileSync(`${path}/${f.name}.json`, JSON.stringify(mod))
      }
      MODS[f.name] = mod;
    }
  }
}
function loadTags() {
  try {
    TAGS = {}
    TAGS = JSON.parse(fs.readFileSync("./Tags.json").toString())
  }catch (err) {
    console.log(err)
  }
}
function saveTags() {
  try {
    fs.writeFileSync("./Tags.json", JSON.stringify(TAGS))
  }catch (err) {
    console.log(err)
  }
}
function refreshMods() {
  saveModInfos();
  MODS = {}
  SearchMods("./Mods", false);
  SearchMods("./Mods_disabled", true);
}
function SearchFixes(fPath) {
  let files = fs.readdirSync(fPath, {withFileTypes: true})
  for (let f of files) {
    if (f.isFile()) {
      let fix = {};
      let ext = path.extname(f.name)
      if (!['.py', '.exe'].includes(ext)) {
        continue
      }
      if (fs.existsSync(`${fPath}/${f.name}.json`)) {
        fix = JSON.parse(fs.readFileSync(`${fPath}/${f.name}.json`).toString())
        CheckFixInfo(fix, f, fPath)
      }else {
        fix = {
          name: f.name,
          dir: f.name,
        }
        fs.writeFileSync(`${fPath}/${f.name}.json`, JSON.stringify(fix))
      }
      FIXES[f.name] = fix;
    }
  }
}

function refreshFixes() {
  saveFixInfos();
  FIXES = {}
  SearchFixes("./Fix");
}

function saveModInfo(modDirName) {
  let p = 'Mods';
  if (MODS[modDirName].disabled) {
    p = 'Mods_disabled';
  }

  const modInfo = MODS[modDirName]; // Assuming 'mods' is a global object or needs to be passed as a parameter
  const jsonData = JSON.stringify(modInfo);

  const filePath = `./${p}/${modDirName}.json`
  fs.writeFileSync(filePath, jsonData, { flag: 'w', encoding: 'utf8' });
}
function saveFixInfo(fixName) {
  let p= "Fix"
  const fixInfo = FIXES[fixName]; // Assuming 'mods' is a global object or needs to be passed as a parameter
  const jsonData = JSON.stringify(fixInfo);
  const filePath = `./${p}/${fixName}.json`
  fs.writeFileSync(filePath, jsonData, { flag: 'w', encoding: 'utf8' });
}
function saveModInfos() {
  for (let m in MODS) {
    saveModInfo(m)
  }
}
function saveFixInfos() {
  for (let m in FIXES) {
    saveFixInfo(m)
  }
}

function deleteObj(name, folder, successCallback = (name) => {}, failCallback = (name, err) => {}) {
  try {
    const dirPath = `./${folder}/${name}`
    const jsonPath = `./${folder}/${name}.json`

    // 首先尝试删除目录
    fs.rmSync(dirPath, { recursive: true, force: true })
    // 从 'mods' 对象中删除条目
    successCallback(name);
    // 然后尝试删除 JSON 文件
    fs.unlinkSync(jsonPath)
    return null
  } catch (err) {
    failCallback(name, err)
    return err
  }
}

function enableMod(modDirName) {
  try {
    // 检查Mods_disabled目录下是否存在mod目录
    const disabledModPath = `./Mods_disabled/${modDirName}`
    if (fs.statSync(disabledModPath)) {
      // 如果存在，则将其重命名为Mods目录下的mod目录
      const modsPath = `./Mods/${modDirName}`
      fs.renameSync(disabledModPath, modsPath);

      // 假设mods[modDirName]是一个对象，并且有一个disabled属性
      MODS[modDirName].disabled = false;

      // 同时，将对应的.json文件也从Mods_disabled移动到Mods目录
      const disabledJsonPath = `./Mods_disabled/${modDirName}.json`
      const jsonPath = `./Mods/${modDirName}.json`
      fs.renameSync(disabledJsonPath, jsonPath);

      // 如果所有操作都成功，返回0
      return null;
    }else {
      let err = new Error()
      err.message = "exist"
      return err
    }

  } catch (err) {
    return err
  }
}

function disableMod(modDirName) {
  try {
    // 检查Mods_disabled目录下是否存在mod目录
    const disabledModPath = `./Mods/${modDirName}`
    if (fs.statSync(disabledModPath)) {
      // 如果存在，则将其重命名为Mods目录下的mod目录
      const modsPath = `./Mods_disabled/${modDirName}`
      fs.renameSync(disabledModPath, modsPath);

      MODS[modDirName].disabled = false;

      // 同时，将对应的.json文件也从Mods_disabled移动到Mods目录
      const disabledJsonPath = `./Mods/${modDirName}.json`
      const jsonPath = `./Mods_disabled/${modDirName}.json`
      fs.renameSync(disabledJsonPath, jsonPath);

      // 如果所有操作都成功，返回0
      return null;
    }else {
      let err = new Error()
      err.message = "exist"
      return err
    }

  } catch (err) {
    return err
  }
}
function renameObj(name, newName, folder, successCallback = (name) => {}, failCallback = (name, err) => {}) {
  try {
    fs.renameSync(`./${folder}/${name}`, `./${folder}/${newName}`)
    successCallback(name, newName);
    try {
      fs.renameSync(`./${folder}/${name}.json`, `./${folder}/${newName}.json`)
      return null
    } catch (err) {
      failCallback(name, err)
      return err
      // res.json({error: err.message})
    }
  } catch (err) {
    failCallback(name, err)
    return err
  }
}
function executeFixInMod(fn, modDirName) {
  let p = "Mods";
  if (MODS[modDirName].disabled) {
    p = "Mods_disabled";
  }
  const sourcePath = `./Fix/${fn}`
  const destPath = `./${p}/${modDirName}/${fn}`

  try {
    // 同步复制文件
    fs.mkdirSync(path.dirname(destPath), { recursive: true }); // 确保目标目录存在
    fs.copyFileSync(sourcePath, destPath);
    // 构造并执行命令
    const command = `start './${fn}'`;
    exec(command, { shell: 'powershell', cwd:  `${process.cwd()}\\${p}\\${modDirName}`});

  } catch (err) {
    console.error('An error occurred:', err);
    return err;
  }
}

// 检测目录
import { fileURLToPath } from "node:url";
let __filename = fileURLToPath(import.meta.url)
let __dirname = path.dirname(__filename)
if (process.cwd() !== __dirname) {
  let command = `node ${path.basename(__filename)}`
  console.log("已尝试重新从目标目录启动")
  execSync(command, {cwd: __dirname})
  process.exit(1)
}

let necessaryDirList = ["./Mods", "./Fix", "./Mods_disabled", "./web"]
for (let d of necessaryDirList) {
  if (!fs.existsSync(d)) {
    fs.mkdir(d, {}, () => {})
  }
}

loadTags();
refreshMods();
refreshFixes();
app.use(cors())
app.use(express.json())
app.use("/", express.static("./web"))
app.all("/api/query_modInfo", (req, res) => {
    res.status(200).send(MODS)
})

app.all("/api/query_fixInfo", (req, res) => {
  res.status(200).send(FIXES)
})

app.all("/api/query_tagInfo", (req, res) => {
  res.status(200).send(TAGS)
})

app.all("/api/refresh_tagInfo", (req, res) => {
  saveTags();
  loadTags();
  console.log(TAGS)
  res.status(200).send(TAGS)
})

app.all("/api/addTag", (req, res) => {
  let label = req.body.label;
  let filter = req.body.filter;
  if (!label) {
    res.status(500).json({error: "empty"})
    return
  }
  if (TAGS[label]) {
    res.status(500).json({error: "exist"})
    return
  }
  TAGS[label] = {label, filter}
  saveTags();
  res.status(200).send("success")
})

app.all("/api/deleteTag", (req, res) => {
  let label = req.body.label;
  if (!label) {
    res.status(500).json({error: "empty"})
    return
  }
  if (!TAGS[label]) {
    res.status(500).json({error: "not exist"})
    return
  }
  delete TAGS[label]
  saveTags();
  res.status(200).send("success")
})


app.all("/api/refresh_modInfo", (req, res) => {
  refreshMods();
  res.status(200).json(MODS);
})

app.all("/api/refresh_fixInfo", (req, res) => {
  refreshFixes();
  res.status(200).json(FIXES);
})

app.all("/api/enableMod", (req, res) => {
  let modDirName = req.body.modDirName;
  if (!modDirName) {
    res.status(500).send( `{"error": "not exist"}`)
    return
  }
  try {
    enableMod(modDirName);
    res.status(200).send("success")
  } catch (err) {
    // 处理EnableMod函数中可能抛出的错误
    res.status(500).json({ error: err.message });
  }
})

app.all("/api/disableMod", (req, res) => {
  let modDirName = req.body.modDirName;
  if (!modDirName) {
    res.status(500).send( `{"error": "not exist"}`)
    return
  }
  try {
    disableMod(modDirName);
    res.status(200).send("success")
  } catch (err) {
    // 处理EnableMod函数中可能抛出的错误
    res.status(500).json({ error: err.message });
  }
})

app.all("/api/deleteMod", (req, res) => {
  let modDirName = req.body.modDirName;
  if (!modDirName) {
    res.status(500).send( `{"error": "not exist"}`)
    return
  }
  try {
    let p = "Mods"
    if (MODS[modDirName].disabled) {
      p = "Mods_disabled"
    }
    deleteObj(modDirName, p, (name) => {delete MODS[name];})
    res.status(200).send("success")
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
})

app.all("/api/deleteFix", (req, res) => {
  let fixName = req.body.fixName;
  if (!fixName) {
    res.status(500).send( `{"error": "not exist"}`)
    return
  }
  try {
    deleteObj(fixName, "Fix", (name) => {delete FIXES[name];})
    res.status(200).send("success")
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
})

app.all("/api/renameMod", (req, res) => {
  let modDirName = req.body.modDirName;
  if (!modDirName) {
    res.status(500).send( `{"error": "not exist"}`)
    return
  }
  let newName = req.body.newName;
  if (!newName) {
    res.status(500).send( `{"error": "no name"}`)
    return
  }
  try {
    MODS[modDirName].name = newName;
    saveModInfo(modDirName)
    res.status(200).send("success")
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
})

app.all("/api/renameFixName", (req, res) => {
  let fixName = req.body.fixName;
  if (!fixName) {
    res.status(500).send( `{"error": "not exist"}`)
    return
  }
  let newName = req.body.newName;
  if (!newName) {
    res.status(500).send( `{"error": "no name"}`)
    return
  }
  try {
    FIXES[fixName].name = newName;
    saveFixInfo(fixName)
    res.status(200).send("success")
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
})

app.all("/api/editModInfo", (req, res) => {
  let originalDir = req.body.originalDir;
  let newName = req.body.newName;
  let tags = req.body["tags"];
  let newDirName = req.body.newDirName
  let sign = [false, false ,false] // name tag dir
  if (!newName) {
    res.status(500).send( `{"error": "not exist"}`)
    return
  }
  if (!newDirName) {
    res.status(500).send( `{"error": "no name"}`)
    return
  }
  if (MODS[originalDir].name !== newName) {
    try {
      MODS[originalDir].name = newName;
      sign[0] = true
    } catch (err) {
      res.status(500).json({ error: err.message });
      return
    }
  }else {
    sign[0] = true
  }
  if (MODS[originalDir].tags !== tags) {
    try {
      MODS[originalDir].tags = tags;
      sign[1] = true
    } catch (err) {
      res.status(500).json({ error: err.message });
      return
    }
  }else {
    sign[1] = true
  }
  if (MODS[originalDir].dir !== newDirName) {
    if (MODS[newDirName]) {
      res.status(500).send(`{"error": "exist"}`)
      return
    }
    const disableInfo = MODS[originalDir].disabled;
    const p = disableInfo ? 'Mods_disabled' : 'Mods';
    try {
      fs.renameSync(`./${p}/${originalDir}`, `./${p}/${newDirName}`)
      MODS[originalDir].dir = newDirName;
      MODS[newDirName] = MODS[originalDir];
      delete MODS[originalDir];
      sign[2] = true
      try {
        fs.renameSync(`./${p}/${originalDir}.json`, `./${p}/${newDirName}.json`)
      } catch (err) {
        res.json({error: err.message})
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }else {
    sign[2] = true
  }
  if (sign[0] && sign[1] && sign[2]) {
    saveModInfo(newDirName)
    res.status(200).send("success")
  }
})

app.all("/api/editFixInfo", (req, res) => {
  let originalFix = req.body.originalFix;
  let newName = req.body.newName;
  let newFileName = req.body.newFileName
  let sign = [false ,false] // name dir
  if (!newName) {
    res.status(500).send( `{"error": "not exist"}`)
    return
  }
  if (!newFileName) {
    res.status(500).send( `{"error": "no name"}`)
    return
  }
  if (FIXES[originalFix].name !== newName) {
    try {
      FIXES[originalFix].name = newName;
      sign[0] = true
    } catch (err) {
      res.status(500).json({ error: err.message });
      return
    }
  }else {
    sign[0] = true
  }
  if (FIXES[originalFix].dir !== newFileName) {
    if (FIXES[newFileName]) {
      res.status(500).send(`{"error": "exist"}`)
      return
    }
    const p= "Fix";
    try {
      fs.renameSync(`./${p}/${originalFix}`, `./${p}/${newFileName}`)
      FIXES[originalFix].dir = newFileName
      FIXES[newFileName] = FIXES[originalFix];
      delete FIXES[originalFix];
      sign[1] = true
      try {
        fs.renameSync(`./${p}/${originalFix}.json`, `./${p}/${newFileName}.json`)
      } catch (err) {
        res.status(500).json({error: err.message})
        return
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
      return
    }
  }else {
    sign[1] = true
  }
  if (sign[0] && sign[1]) {
    saveFixInfo(newFileName)
    res.status(200).send("success")
  }
})

app.all("/api/editTag", (req, res) => {
  let initVal = req.body.initVal;
  let label = req.body.label;
  let filter = req.body.filter;
  if (!label) {
    res.status(500).json({error: "empty Val"})
    return
  }
  if (initVal === label) {
    TAGS[initVal].filter = filter;
    res.status(200).send("success")
  }else {
    if (TAGS[label]) {
      res.status(500).json({error: "exist"})
    }else {
      TAGS[initVal].label = label;
      TAGS[initVal].filter = filter;
      TAGS[label] = TAGS[initVal];
      delete TAGS[initVal]
      saveTags();
      res.status(200).send("success")
    }
  }
})

app.all("/api/renameModDir", (req, res) => {
  let modDirName = req.body.modDirName;
  if (!modDirName) {
    res.status(500).send( `{"error": "not exist"}`)
    return
  }
  let newName = req.body.newName;
  if (!newName) {
    res.status(500).send( `{"error": "no name"}`)
    return
  }
  if (MODS[newName]) {
    res.status(500).send(`{"error": "exist"}`)
    return
  }
  let p = "Mods"
  if (MODS[modDirName].disabled) {
    p = "Mods_disabled"
  }
  try {
    renameObj(modDirName, newName, p, (name, newName)=>{
      MODS[newName] = MODS[name];
      delete MODS[name];
    })
    saveModInfo(newName)
    res.status(200).send("success")
  }catch (err) {
    res.status(500).send(err)
  }
})

app.all("/api/renameFixFile", (req, res) => {
  let fixName = req.body.fixName;
  if (!fixName) {
    res.status(500).send( `{"error": "not exist"}`)
    return
  }
  let newName = req.body.newName;
  if (!newName) {
    res.status(500).send( `{"error": "no name"}`)
    return
  }
  if (FIXES[newName]) {
    res.status(500).send(`{"error": "exist"}`)
    return
  }
  try {
    renameObj(fixName, newName, "Fix", (name, newName)=>{
      FIXES[newName] = FIXES[name];
      delete FIXES[name];
    })
    res.status(200).send("success")
  }catch (err) {
    res.status(500).send(err)
  }
})

app.all('/api/openModDirectory', (req, res) => {
  const modDirName = req.body.modDirName;
  if (!modDirName) {
    res.status(500).send( `{"error": "not exist"}`)
    return
  }
  let p = "Mods";
  if (MODS[modDirName].disabled) {
    p = "Mods_disabled"
  }
  try {
    exec(`explorer '.\\${p}\\${modDirName}'`, {shell: "powershell"})
    res.status(200).send("success");
  } catch (err) {
    res.status(500).json({ error: error.message });
  }

});

app.all('/api/openFixDirectory', (req, res) => {
  try {
    exec(`explorer '.\\Fix'`, {shell: "powershell"})
    res.status(200).send("success");
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.all("/api/run3DMigoto", (req, res) => {
  try {
    // 使用 PowerShell 启动 3DMigoto Loader.exe
    exec('start "./3DMigoto Loader.exe"', {shell: "powershell"});
    res.status(200).send({ message: '3DMigoto Loader started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
})

app.all("/api/executeFixInMod", (req, res) => {
  const modDirName = req.body.modDirName;
  if (!modDirName) {
    res.status(500).send( `{"error": "not exist"}`)
    return
  }
  const fixName = req.body.fixName;
  if (!fixName) {
    res.status(500).send( `{"error": "not exist"}`)
    return
  }
  try {
    // 使用 PowerShell 启动 3DMigoto Loader.exe
    executeFixInMod(fixName, modDirName)
    res.status(200).send({ message: 'success' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
})

app.listen(port, () => {
  console.log("服务已启动 http://localhost:7777/api/*")
  console.log("自动挂载 ./web 为 http://localhost:7777/")
})