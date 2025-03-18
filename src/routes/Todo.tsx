import { useState, useEffect } from "react";
import { useFireproof } from "use-fireproof";
import { registerGDriveStoreProtocol } from "@fireproof/connect/drive-gateway";

interface Todo {
  text: string;
  date: number;
  completed: boolean;
}
let tokenClient;
var searchResult;
var dataTableId;
var appDirInited = false;
let gapiInited = false;
let gisInited = false;
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";
const SCOPES =
  "https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.install https://www.googleapis.com/auth/docs https://www.googleapis.com/auth/drive.photos.readonly https://www.googleapis.com/auth/drive.apps.readonly https://www.googleapis.com/auth/drive.apps.readonly https://www.googleapis.com/auth/drive.apps https://www.googleapis.com/auth/activity https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.meet.readonly https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.metadata https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.scripts https://www.googleapis.com/auth/drive.activity https://www.googleapis.com/auth/drive.activity.readonly https://www.googleapis.com/auth/gmail.readonly";
var appDirectory = "";
export default function TodoList() {
  useEffect(() => {
    gapi.load("client", initializeGapiClient);

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: "971251584999-103baque519j3u1ubrcq4m0f682mrtnf.apps.googleusercontent.com",
      scope: SCOPES,
      callback: "", // defined later
    });
    gisInited = true;
  }, []);
  registerGDriveStoreProtocol("gdrive:", "ya29.a0AeXRPp6CDNmp1lCbboNrOS6OGiEEx1z-aLZfP1_MyRePrLHyMw5Y87pD8LnBafCZS95pp672fBf9lqYmx_n2XURw44b1DDRD8xfEvwbaJ0COUqZNKB57KTAMuV8UZ3l31aU3HCxdgMFDYJZrTZPWwDqhhnuDmyvqXSQaPNXsaCgYKAcYSAQ8SFQHGX2MihNOv-Xa3U0oaWV_nk7g-6Q0175");
  const { useDocument, useLiveQuery, database } = useFireproof("TodoDB",{storeUrls:{base:"gdrive://www.googleapis.com/"}});

  //const { useDocument, useLiveQuery, database } = useFireproof("TodoDB");
  const [selectedTodo, setSelectedTodo] = useState<string>("");
  var todos = useLiveQuery<Todo>("date", { limit: 10, descending: true });
  useEffect(() => {
    console.log('Updated todos:', todos);
    if(appDirInited===true){
      sync(dataTableId, JSON.stringify(todos));
    }
  }, [todos]);
  
  const [loggedin, setLoggedin] = useState<boolean>(false);
  const [visibility, setVisibility] = useState<string>("block");
  //console.log(todos);

  const initializeGapiClient = async () => {
    await gapi.client.init({
      apiKey: "AIzaSyAYb09Zym_Ax-OZ12Fi0a4X-IMrtJWu_O0",
      discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
  };

  const handleAuthClick = () => {
    tokenClient.callback = async (resp) => {
      if (resp.error !== undefined) {
        throw resp;
      }
      setLoggedin(true);
      setVisibility('none');

      console.log(await database.put({test: "ok"}));
      console.log(resp.access_token);
      
      await initAppDir();
      if ("undefined" !== typeof dataTableId) {
        const fromTheCloud = JSON.parse(await select(dataTableId));
        if(fromTheCloud.length > todos.length ){
          const newTodos = fromTheCloud.docs;
            //todos = fromTheCloud;
            newTodos.forEach(async(newTodo) => {
              saveTodo(newTodo);
            });           
        }else{
          sync(dataTableId, JSON.stringify(todos));        
        }
      }
    };
    if (gapi.client.getToken() === null) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      // when establishing a new session.
      tokenClient.requestAccessToken({ prompt: "consent" });
    } else {
      // Skip display of account chooser and consent dialog for an existing session.
      tokenClient.requestAccessToken({ prompt: "" });
    }
  };
  const initAppDir = async () => {
    let response;
    var exists = false;
    // Preparing demo content
    const fileContent = JSON.stringify({});
    // Search for appDirectory
    searchResult = await search("mimeType = 'application/vnd.google-apps.folder'", "files(name,id)", "appDirectory");

    if (searchResult !== 404) {
      appDirectory = searchResult;
      console.log(appDirectory);

      // Search for the data table
      searchResult = await search(
        '"' + appDirectory + '" in parents and mimeType="text/plain" and name="data.json"',
        "files(id, name, mimeType)",
        "data.json",
      );

      if (searchResult === 404) {
        // Create new data table within appDirectory
        createTable("data", appDirectory, fileContent);
      } else {
        dataTableId = searchResult;
      }
    } else {
      // Create new appDirectory
      response = await createDir("appDirectory");
      if (response.status === 200) {
        appDirectory = response.result.id;
        console.log(appDirectory);

        // Create new data table within appDirectory
        createTable("data", appDirectory, fileContent);
      }
    }
    appDirInited = true;
  };
  const select = async(fid) => {
    // Get the file content
    try{
      const r = await gapi.client.drive.files.get({
        'fileId': fid,
        'alt': 'media'
      });
      return r.body;
    }catch(err){
      console.log(`An error occured, ${err}`);
    }  
    
  }
  const search = async (query, returnFields, fileName) => {
    let response;
    var result;
    var exists = false;
    console.log("Searching 🔍");
    try {
      response = await gapi.client.drive.files.list({
        q: query,
        pageSize: 100,
        fields: returnFields,
      });
    } catch (err) {
      console.log(`An error occured ${err}`);
    }
    const files = response.result?.files;
    if ("undefined" === typeof files || files.length == 0) {
      console.log(`Not found! ❌`);
      result = 404;
    } else {
      if (fileName !== "") {
        files.forEach(async function (data, index) {
          if (data.name === fileName) {
            console.log(`${fileName} exists! ✅`);
            exists = true;
            result = data.id;
          }
          if (index === files.length - 1 && exists === false) {
            console.log(`${fileName} does not exists ❌`);
            result = 404;
          }
        });
      } else {
        console.log(`File exists! ✅`);
        result = 200;
      }
    }
    return result;
  };
  const createDir = async (dirName) => {
    console.log(`Creating ${dirName} 🔄`);
    const r = await gapi.client.drive.files.create({
      name: "appDirectory",
      mimeType: "application/vnd.google-apps.folder",
      fields: "id, parents",
    });
    if (r.status === 200) {
      console.log(`${dirName} created ✅`);
    } else {
      console.log(`An error occured, error: ${response.status}`);
    }
    return r;
  };
  // Equivalent of insert
  const createTable = (tableName, parentDir, content) => {
    console.log(`Creating ${tableName} 🔄`);
    if (tableName.indexOf(".json") < 0) {
      tableName = tableName + ".json";
    }

    var file = new Blob([content], { type: "text/plain" });
    var metadata = {
      name: tableName,
      mimeType: "text/plain",
      parents: [parentDir], // Google Drive folder id
    };

    var accessToken = gapi.auth.getToken().access_token;
    var form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);

    fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true", {
      method: "POST",
      headers: new Headers({ Authorization: "Bearer " + accessToken }),
      body: form,
    })
      .then((res) => {
        if (res.status === 200) {
          console.log(`${tableName} created ✅`);
        } else {
          console.log(`HTTP error! status: ${response.status}`);
        }
        return res.json();
      })
      .then(function (val) {
        console.log(val);
        dataTableId = val.id;
      });
  };
  const sync = (fileId, content) => {
    if (typeof content !== "undefined") {
      var contentArray = new Array(content.length);
      for (var i = 0; i < contentArray.length; i++) {
        contentArray[i] = content.charCodeAt(i);
      }
      var byteArray = new Uint8Array(contentArray);
      var blob = new Blob([byteArray], { type: "text/plain" });
      var request = gapi.client.drive.files.get({ fileId: fileId });
      request.execute(function (resp) {
        updateFile(fileId, resp, blob, changesSaved);
      });
    }
  };
  
  const changesSaved = () => {
    console.log("Synced ✅");
  };
  const updateFile = (fileId, fileMetadata, fileData, callback) => {
    const boundary = "-------314159265358979323846";
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    var reader = new FileReader();
    reader.readAsBinaryString(fileData);
    reader.onload = function (e) {
      var contentType = fileData.type || "application/octet-stream";
      var base64Data = btoa(reader.result);
      var multipartRequestBody =
        delimiter +
        "Content-Type: application/json\r\n\r\n" +
        JSON.stringify(fileMetadata) +
        delimiter +
        "Content-Type: " +
        contentType +
        "\r\n" +
        "Content-Transfer-Encoding: base64\r\n" +
        "\r\n" +
        base64Data +
        close_delim;

      var request = gapi.client.request({
        path: "/upload/drive/v2/files/" + fileId,
        method: "PUT",
        params: { uploadType: "multipart", alt: "json" },
        headers: {
          "Content-Type": 'multipart/mixed; boundary="' + boundary + '"',
        },
        body: multipartRequestBody,
      });
      if (!callback) {
        callback = function (file) {};
      }
      request.execute(callback);
    };
  };

  const [todo, setTodo, saveTodo] = useDocument<Todo>(() => ({
    text: "",
    date: Date.now(),
    completed: false,
  }));
  return (
    <>
      <pre id="content"></pre>
      <button onClick={handleAuthClick} style={{ display: visibility }} id="loginDiv">
        Login
      </button>
      {loggedin && (
        <div>
          <div>
            <input
              type="text"
              value={todo.text}
              placeholder="new todo here"
              onChange={(e) => {
                setTodo({ text: e.target.value.trim() });
              }}
            />
            <button
              onClick={async () => {
                await saveTodo();
                setTodo();
              }}
            >
              Add Todo
            </button>
          </div>
          {todos.docs.map((todo) => (
            <div key={todo._id}>
              <input type="radio" checked={selectedTodo === todo._id} onChange={() => setSelectedTodo(todo._id as string)} />
              <span
                style={{
                  textDecoration: todo.completed ? "line-through" : "none",
                }}
              >
                {todo.text}
              </span>
            </div>
          ))}
          {selectedTodo && <TodoEditor id={selectedTodo} />}
        </div>
      )}
    </>
  );
}

interface TodoEditorProps {
  readonly id: string;
}

function TodoEditor({ id }: TodoEditorProps) {
  const { useDocument } = useFireproof("TodoDB");
  const [todo, setTodo, saveTodo] = useDocument<Todo>(() => ({
    _id: id, // showcase modifying an existing document
    text: "",
    date: Date.now(),
    completed: false,
  }));

  return (
    <div id="todo-editor">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={async () => await saveTodo({ ...todo, completed: !todo.completed })}
      />
      <input
        type="text"
        value={todo.text}
        placeholder="new todo here"
        onChange={(e) => {
          setTodo({ text: e.target.value.trim() });
        }}
      />
      <button
        onClick={async () => {
          await saveTodo();
          setTodo();
        }}
      >
        Save Changes
      </button>
    </div>
  );
}
