function getDb() {
    var defer = Q.defer();
    var db = new Dexie("pms5")
    console.log("check pms5 exists isOpen:", db.isOpen());
    Dexie.exists(db.name).then((exists) => {
        if (!exists) {
            console.log("no pms5 initing...");
            db.version(1).stores({})
        } else {
            console.log("pms5 exists")
        }
        db.open().then((newDb) => {
            console.log("open db version:", newDb.verno, newDb.tables);
            defer.resolve(newDb)
        })
    })
    return defer.promise;
}

//将表定义转换为对象模式，方便比较
function parseSchema(schema) {
    var schemaInfos = [];
    for (var tableName in schema) {
        var indexes = schema[tableName] ? schema[tableName].split(",") : [];
        schemaInfos.push({ tableName: tableName, indexes: indexes });
    }
    return schemaInfos;
}

//获取定义中的表的索引
function getTableIndexes(table) {
    var indexes = [];
    indexes.push(table.schema.primKey.src);
    table.schema.indexes.forEach((index) => {
        indexes.push(index.src);
    })
    return indexes;
}

//判断两个索引集合是否相同
function isIndexexSame(tableIndexes, schemaIndexes) {
    if (tableIndexes.length !== schemaIndexes.length) {
        return false;
    } else {
        //a的元素在b中都能找到，b的元素在a中都能找到，则相同
        var a = tableIndexes, b = schemaIndexes;
        var ina = true, inb = true;
        a.forEach((aIndex) => {
            var toFinds = b.filter((bIndex) => {
                return aIndex === bIndex;
            })
            if (toFinds && toFinds.length === 0) {
                ina = false;
            }
        })
        b.forEach((bIndex) => {
            var toFinds = a.filter((aIndex) => {
                return bIndex === aIndex;
            })
            if (toFinds && toFinds.length === 0) {
                inb = false;
            }
        })

        if (ina && inb) {
            return true;
        } else {
            return false;
        }
    }
}

//判断表是否需要更新
function isTableNeedUpdate(db, schemaInfos) {
    for (var i = 0; i < schemaInfos.length; i++) {
        var schemaInfo = schemaInfos[i];
        var toFinds = db.tables.filter((table) => {
            return table.name === schemaInfo.tableName;
        })
        if (toFinds && toFinds.length) {
            //如果找到了，需要判断索引是否相同
            var tableIndexes = getTableIndexes(toFinds[0]);
            var isSame = isIndexexSame(tableIndexes, schemaInfo.indexes);
            if (!isSame) {
                return true;
            }
        } else {
            return true;
        }
    }
    return false;
}

//获取所有表的定义结构
function getAllTableSchema(db) {
    var schema = {};
    db.tables.forEach(table => {
        var indexes = getTableIndexes(table);
        schema[table.name] = indexes.join(',');
    })
    return schema;
}

function changeSchema(changeSchemas) {
    var defer = Q.defer();
    getDb().then(db => {
        db.open().then(() => {
            console.log("now tables:", db.tables.length);
            //判断是否需要更新,如果不判断是否需要更新，那么版本号会随着调用一直增加,虽然版本号是js最大整数/10
            var schemaInfos = parseSchema(changeSchemas);
            var needUpdate = isTableNeedUpdate(db, schemaInfos);

            if (!needUpdate) {
                console.log("db not need update");
                defer.resolve(db);
            } else {
                console.log("db need update");
                var verno = db.verno;
                db.close();
                var dbSchema = getAllTableSchema(db);
                var newDb = new Dexie(db.name);
                newDb.version(verno).stores(dbSchema);
                newDb.version(verno + 1).stores(changeSchemas);
                newDb.open().then(() => {
                    defer.resolve(newDb);
                })
            }

        })
    })
    return defer.promise;
}

window.onload = function() {
    var schema = document.getElementById("schema");
    var addTableBtn = document.getElementById("addTable");
    var tableName = document.getElementById("tableName");
    var insertValue = document.getElementById("insertValue");
    var addValueBtn = document.getElementById("addValue");
    var delTableName = document.getElementById("dleTableName");
    var delBtn = document.getElementById("delBtn");

    addTableBtn.onclick = function() {
        var schemaTxt = schema.value;
        var schemaObj = JSON.parse(schemaTxt);
        changeSchema(schemaObj).then((db) => {
            db.close();
        });
    }

    addValueBtn.onclick = function() {
        var tableNameTxt = tableName.value;
        var value = insertValue.value;
        var valueObj = JSON.parse(value);
        getDb().then((db) => {
            //INFO:注意这里，如果使用动态模式，表的访问需要使用table函数进行
            db.table(tableNameTxt).add(valueObj).then(() => {
                db.close();
            })
        })
    }

    delBtn.onclick = function() {
        var delName = delTableName.value;
        var schema = {};
        schema[delName] = null;
        changeSchema(schema).then((db) => {
            db.close();
        })
    }
}

