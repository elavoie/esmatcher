var esprima = require("esprima");
var escodegen = require("escodegen");
var fs = require("fs");
var esmatcher = require("esmatcher");

var extendedGenericTraverser = esmatcher.createInplaceTraverser(esmatcher.genericTraversal,[
    // Custom-defined nodes
    {
        type: "ObjectGetExpression",
        object: ["match"],
        property: ["match"]
    },{
        type: "ObjectSetExpression",
        object: ["match"],
        property: ["match"],
        right: ["match"]
    },{
        type: "ObjectDeleteExpression",
        object: ["match"],
        property: ["match"]
    },{
        type: "FunctionCallExpression",
        callee: ["match"],
        arguments: ["matchAll"],
    },{
        type: "MethodCallExpression",
        object: ["match"],
        property: ["match"],
        arguments: ["matchAll"]
    },{
        type: "EnvironmentGetExpression",
        id: ["match"]
    },{ 
        type: "EnvironmentSetExpression",
        id: ["match"],
        right: ["match"]
    }

]);

var syntax2semantics = esmatcher.createMatcher(extendedGenericTraverser, [
    // Object Get Expression
    {
        type: "MemberExpression",
        computed: /b/,
        object: /o/,
        property: /p/
    }, // -->
    {
        type: "ObjectGetExpression",
        computed: /b/,
        object: ["match", /o/],
        property: ["match", /p/]
    },
    // Object Set Expression
    {
        type: "AssignmentExpression",
        operator: /op/,
        left: {
            type: "MemberExpression",
            computed: /b/,
            object: /o/,
            property: /p/
        },
        right: /r/
    }, // -->
    {
        type: "ObjectSetExpression",
        operator: /op/,
        computed: /b/,
        object: ["match", /o/],
        property: ["match", /p/],
        right: ["match", /r/]
    },
    // Object Delete Expression
    {
        type: "UnaryExpression",
        operator: "delete",
        argument: {
            type: "MemberExpression",
            computed: /b/,
            object: /o/,
            property: /p/
        },
        prefix: true
    }, // -->
    {
        type: "ObjectDeleteExpression",
        computed: /b/,
        object: ["match", /o/],
        property: ["match", /p/]
    },
    // Method Call Expression
    {
        type: "CallExpression",
        callee: {
            type: "MemberExpression",
            computed: /b/,
            object: /o/,
            property: /p/
        },
        arguments: /args/
    }, // -->
    {
        type: "MethodCallExpression",
        computed: /b/,
        object: ["match", /o/],
        property: ["match", /p/],
        arguments: ["matchAll", /args/]
    },
    // Function Call Expression
    {
        type: "CallExpression",
        callee: /f/, 
        arguments: /args/
    }, // -->
    {
        type: "FunctionCallExpression",
        callee: ["match", /f/],
        arguments: ["matchAll", /args/]
    },
]);

var semantics2syntax = createMatcher(extendedGenericTraverser, [
    // Object Get Expression
    {
        type: "ObjectGetExpression",
        computed: /b/,
        object: /o/,
        property: /p/
    }, // -->
    {
        type: "MemberExpression",
        computed: /b/,
        object: ["match", /o/],
        property: ["match", /p/]
    }, 
    // Object Set Expression
    {
        type: "ObjectSetExpression",
        operator: /op/,
        computed: /b/,
        object: /o/,
        property: /p/,
        right: /r/
    }, // -->
    {
        type: "AssignmentExpression",
        operator: /op/,
        left: {
            type: "MemberExpression",
            computed: /b/,
            object: ["match", /o/],
            property: ["match", /p/]
        },
        right: ["match", /r/]
    }, 
    // Object Delete Expression
    {
        type: "ObjectDeleteExpression",
        computed: /b/,
        object: /o/,
        property: /p/
    }, // -->
    {
        type: "UnaryExpression",
        operator: "delete",
        argument: {
            type: "MemberExpression",
            computed: /b/,
            object: ["match", /o/],
            property: ["match", /p/]
        },
        prefix: true
    }, 
    // Method Call Expression
    {
        type: "MethodCallExpression",
        computed: /b/,
        object: /o/,
        property: /p/,
        arguments: /args/
    }, // -->
    {
        type: "CallExpression",
        callee: {
            type: "MemberExpression",
            computed: /b/,
            object: ["match", /o/],
            property: ["match", /p/]
        },
        arguments: ["matchAll", /args/]
    },
    // Function Call Expression
    {
        type: "FunctionCallExpression",
        callee: /f/,
        arguments: /args/
    }, // -->
    {
        type: "CallExpression",
        callee: ["match", /f/], 
        arguments: ["matchAll", /args/]
    }, 
]);

var input = (
{
    "type": "Program",
    "body": [
        {
            "type": "ExpressionStatement",
            "expression": {
                "type": "CallExpression",
                "callee": {
                    "type": "MemberExpression",
                    "computed": false,
                    "object": {
                        "type": "Identifier",
                        "name": "a"
                    },
                    "property": {
                        "type": "Identifier",
                        "name": "b"
                    }
                },
                "arguments": []
            }
        }
    ]
}
);

var options = {
    filename:null,
    showHelp:false
};

for (var i = 1; i < process.argv.length; ++i) {
    var arg = process.argv[i];
    if (arg === "-h") {
       options.showHelp = true; 
    } else if (i > 1) {
        options.filename = arg;
    }
}

if (options.filename === null || options.showHelp || process.argv.length <= 1) {
    process.stdout.write("Usage: node semanticInstrumentation.js <filename>\n");
    process.exit(1);
}


var input = esprima.parse(fs.readFileSync(options.filename));

var orig = JSON.stringify(input,null,"    ");
//print(orig);
//fs.writeFileSync("log.txt", orig);


//var transformed = JSON.stringify(genericTraversal(input, genericTraversal),null,"    ");



var transformed = JSON.stringify(semantics2syntax(syntax2semantics(input)),null,"    ");
//print(transformed);

//fs.writeFileSync("log2.txt", transformed);

console.log(orig === transformed);

