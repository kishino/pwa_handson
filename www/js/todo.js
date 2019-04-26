var TODO = 'TODO';
var DOMAIN = 'https://cloud.raku-za.jp/stage/baas-dev/api_control';
var TENANT_KEY = 21010

function getUserAccessToken() {
  return localStorage.getItem('userAccessToken')
}
function setUserAccessToken(userAccessToken) {
  return localStorage.setItem('userAccessToken', userAccessToken)
}

// オフライン時に追加/削除するTodo入れておくキュー
var queues = {add: [], delete: []};
for (var name of ['add', 'delete']) {
  var value = localStorage.getItem(name + 'Queue');
  if (value) {
    queues[name] = JSON.parse(value);
  }
}

$(function() {
  var todoController = {
    __name: 'TodoController',
    // テンプレートの指定
    // index.html内に記述あり
    __template: 'listTemplate',
    // Todoを入れておく変数
    __todoResult: null,

    // DOM構築、コントローラ化が終わったタイミングで呼ばれるイベント
    // Todoの初期表示を実行
    __ready: function() {
      var me = this;

      // 初回だけ匿名ユーザーを登録
      this.registerUser().then(function () {
        // Todoをサーバから取得
        return $.ajax({
          url: DOMAIN + '/my/user_detail/get/todo',
          type: 'POST',
          data: {
            tenant_id: TENANT_KEY,
            contents: {
              user_access_token: getUserAccessToken(),
              search_condition: {
                key: TODO,
                not_use_flg: '0'
              }
            }
          }
        })
      })
      .then(function(result) {
        if (!result.contents.data) {
          result.contents.data = []
        }

        // 結果を変数に入れておく
        me.__todoResult = result
        // 表示を更新
        me.updateView();

        // キューを処理
        if (navigator.onLine) {
          me.executeQueue(queues);
        }
      })
    },
    registerUser: function () {
      if (getUserAccessToken()) {
        // 登録済みの場合、何もしない
        return Promise.resolve()
      }

      // 匿名ユーザーを新規登録
      return $.ajax({
        url: DOMAIN + '/users/regist',
        type: 'POST',
        data: {
          tenant_id: TENANT_KEY,
          contents: {
            mode: 'execute',
            event_no: '201',
            free_columns: {
              user_high_class_cd: '0001'
            }
          }
        }
      }).then(function (data) {
        // 登録した匿名ユーザーのアクセストークンをローカルストレージに保存
        setUserAccessToken(data.contents.user_info.user_access_token)
      })
    },
    // Todoの登録処理
    'button click': function(context, $el) {
      context.event.preventDefault();
      var me = this;
      // 登録するTodo
      var todo = this.$find('input#inputTodo').val();

      // 必須チェック
      if (!todo) {
        alert('Todoを入力して下さい。')
        return
      }

      this.addTodo(todo)
        .then(function(result) {
          // サーバから取得したTodoを追加
          me.__todoResult.contents.data.push({
            todo
          })

          // 表示を更新
          me.updateView();
          // 入力欄を消す
          me.$find('input#inputTodo').val('');
        });
    },
    // Todoを削除する処理
    '.delete click': function(context, $el) {
      var todo = $el.data('todo');
      var me = this;
      this.deleteTodo(todo)
        .then(function(result) {
          // 変数からタスクを消す
          me.__todoResult.contents.data = me.__todoResult.contents.data.filter(function(t) {
            return t.todo !== todo;
          });

          // 表示を更新
          me.updateView();
        })
    },
    // Todo追加、削除の実行
    executeTask: function(action, todo) {
      switch (action) {
      case 'add':
        this.addTodo(todo);
        break;
      case 'delete':
        this.deleteTodo(todo);
        break;
      }
    },
    // キューを処理する
    executeQueue: function(queues) {
      var me = this;
      for (var action of ['add', 'delete']) {
        for (var todo of queues[action]) {
          this.executeTask(action, todo);
        }
        queues[action] = [];
        localStorage.setItem(action + 'Queue', []);
      }
    },
    // 表示を更新する処理
    updateView: function() {
      var me = this;
      // 表示を更新
      this.view.update('#list', 'listTemplate', {
        todos: this.__todoResult.contents.data.map(function (todo) {
          return todo.todo;
        })
      });
      // Service Workerのキャッシュを更新します（第5章）
    },
    // Todoを追加する処理
    addTodo: function(todo) {
      return new Promise(function(res, rej) {
        // オフライン時の処理（第6章で追加）

        // オンライン時の処理
        // サーバに登録
        $.ajax({
          url: DOMAIN + '/my/user_detail/add/todo',
          type: 'POST',
          data: {
            tenant_id: TENANT_KEY,
            contents: {
              user_access_token: getUserAccessToken(),
              free_columns: {
                key: TODO,
                todo
              }
            }
          }
        })
        .then(function(result) {
          res({status: 'created', todo: result.contents.data[0].todo})
        });
      })
    },
    // Todoを削除する処理
    deleteTodo: function(todo) {
      return new Promise(function(res, rej) {
        // オフライン時
        if (!navigator.onLine) {
          queues.delete.push(todo);
          localStorage.setItem('deleteQueue', JSON.stringify(queues.delete));
          return res({todo});
        }
        // オンライン時はサーバに送信
        $.ajax({
          url: DOMAIN + '/my/user_detail/delete/todo',
          type: 'POST',
          data: {
            tenant_id: TENANT_KEY,
            contents: {
              user_access_token: getUserAccessToken(),
              search_condition: {
                key: TODO,
                todo,
                not_use_flg: '0'
              },
              free_columns: {
                not_use_flg: '1'
              }
            }
          }
        })
        .then(function(result) {
          return res(todo);
        })
      })
    },
    // オンライン復帰時の処理（第6章用）
    '{window} online': function(context) {
    }
  };
  h5.core.controller('.container', todoController);
});
