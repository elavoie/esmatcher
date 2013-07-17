function createCodeGenerator() {
    var indent = 0;
    var code = "";

    var f = function (s) {
        for (var i = 0; i < indent; ++i) {
            code += "    ";
        }
        code += s;
        code += "\n";
    };

    f.incIndent = function () {
        indent++;    
    }

    f.decIndent = function () {
        indent--;
    }

    f.nl = function () {
        code += "\n";
    };

    f.getCode = function () {
        return code;
    }

    return f;
}

function toProgramString(s) {
    return "\"" + s + "\"";
}

function createMatcher(parentMatcher, rules) {
    var ruleNb = 0;
    var genCode = createCodeGenerator();

    function genMatch(currentNode, subpattern) {
        for (var property in subpattern) {
            propertyValue = subpattern[property];

            if (typeof propertyValue === "string") {
                // Verify that the source string value is identical to the pattern string value
                genCode("if (" + currentNode + "." + property + " !== " + toProgramString(propertyValue) + ") throw MATCH_FAILED;");
            } else if (typeof propertyValue === "boolean") {
                // Verify that the source boolean value is identical to the pattern boolean value
                genCode("if (" + currentNode + "." + property + " !== " + propertyValue + ") throw MATCH_FAILED;");
            } else if (propertyValue instanceof Array){
                throw "Invalid pattern property type '" + (typeof propertyValue) + "' when parsing property '" + property + "'";
            } else if (typeof propertyValue === "object") {
                if (propertyValue instanceof RegExp) {
                    // Extract value from source and assign to local variable
                    var id = propertyValue.source;

                    if (Object.prototype.hasOwnProperty.call(currentIDs, id)) { throw "Variable '" + id + "' already defined."; }

                    currentIDs[id] = true;
                    genCode("var " + id + " = " + currentNode + "." + property + ";"); 
                } else {
                    genMatch(currentNode + "." + property, propertyValue);
                }
            } else {
                throw "Invalid pattern property type '" + (typeof propertyValue) + "' when parsing property '" + property + "'";
            }
        }
    }

    function genResult(subresult) {
        for (var property in subresult) {
            propertyValue = subresult[property];

            if (typeof propertyValue === "string") {
                // Create property with string value
                genCode(property + ": " + toProgramString(propertyValue) + ",");
            } else if (typeof propertyValue === "boolean") {
                // Create property with boolean value
                genCode(property + ": " + propertyValue + ",");
            } else if (propertyValue instanceof Array){
                if (propertyValue[0] === "match" && propertyValue[1] instanceof RegExp) {
                    var id = propertyValue[1].source;
                    if (!Object.prototype.hasOwnProperty.call(currentIDs, id)) { throw "Variable '" + id + "' has not been declared in subresult for rule '" + (ruleNb - 1) + "'"; }
                    genCode(property + ": match(" + id + ",match),"); 
                } else if (propertyValue[0] === "matchAll" && propertyValue[1] instanceof RegExp) {
                    var id = propertyValue[1].source;
                    if (!Object.prototype.hasOwnProperty.call(currentIDs, id)) { throw "Variable '" + id + "' has not been declared in subresult for rule '" + (ruleNb - 1) + "'"; }

                    genCode(property + ": " + id + ".map(function (x) { return match(x,match); }),"); 
                } else {
                    throw "Invalid pattern property type '" + (typeof propertyValue) + "' when parsing property '" + property + "'";
                }
            } else if (typeof propertyValue === "object") {
                if (propertyValue instanceof RegExp) {
                    // Create property with local variable value 
                    var id = propertyValue.source;
                    genCode(property + ": " + id + ","); 
                } else {
                    genCode(property + ": {");
                    genCode.incIndent();
                    genResult(propertyValue);
                    genCode.decIndent();
                    genCode("},");
                }
            } else {
                throw "Invalid pattern property type '" + (typeof propertyValue) + "' when parsing property '" + property + "'";
            }
        }
    }

    var currentNodeName = "createMatcherCurrentNode";

    genCode.incIndent();
    genCode("var MATCH_FAILED = new Error(" + toProgramString("Match Failed!") + ");");
    genCode.decIndent();

    for (var i = 0; i < rules.length; i += 2) {
        var pattern = rules[i];
        var result  = rules[i+1];

        genCode.incIndent();

        genCode.nl();
        genCode("function case" + ruleNb++ + "(" + currentNodeName + ",match) {");
        genCode.incIndent();

        var currentIDs = {};
        genMatch(currentNodeName, pattern);
        
        genCode.nl();

        genCode("return {")
        genCode.incIndent();
        genResult(result);
        genCode.decIndent();
        genCode("};");
        
        genCode.decIndent();
        genCode("}");
        genCode.decIndent();
    }

    genCode.incIndent();
    genCode("return function match(ast,match) {");
    genCode.incIndent();

    for (var i = 0; i < ruleNb; ++i) {
        genCode("try {");
        genCode.incIndent();
        genCode("return case" + i + "(ast,match);")
        genCode.decIndent();
        genCode("} catch (e) {");
        genCode.incIndent();
    }

    genCode("return parentMatcher(ast,match);");

    for (var i = 0; i < ruleNb; ++i) {
        genCode.decIndent();
        genCode("}");
    }
    genCode.decIndent();

    genCode("}");
    genCode.decIndent();

    var f = new Function(["parentMatcher"], genCode.getCode())(parentMatcher);

    console.log(genCode.getCode());

    return function (ast) {
        return f(ast,f);
    };
}

function createInplaceTraverser(parentMatcher, rules) {
    var types = {};
    var genCode = createCodeGenerator();

    genCode("return function (node,match) {");

    genCode.incIndent();
    genCode("if (node === null) return node;");
    genCode.nl();


    genCode("switch(node.type) {");
    genCode.incIndent();

    for (var i = 0; i < rules.length; ++i) {
        var pattern = rules[i];

        if (!pattern.hasOwnProperty("type")) {
            throw new Error("Pattern '" + i + "' has no type property.");
        }

        if (Object.prototype.hasOwnProperty.call(types, pattern.type)) {
            throw new Error("Pattern type '" + pattern.type + "' has already been defined.");
        }
        types[pattern.type] = true;

        genCode("case " + toProgramString(pattern.type) + ":");
        genCode.incIndent();

        for (var property in pattern) {
            if (property === "type") continue;

            var propertyValue = pattern[property];

            if (propertyValue instanceof Array) {

                if (propertyValue[0] === "match") {
                    if (propertyValue.length === 1) {
                        // Match a single value
                        genCode("node." + property + " = match(node." + property + ",match);");
                    } else {
                        throw new Error("Invalid property operation '" + propertyValue + "'");
                    }
                } else if (propertyValue[0] === "matchAll")  {
                    // Match all values in an array
                    genCode("for (var i = 0; i < node." + property + ".length; ++i) {")
                    genCode.incIndent();
                    if (propertyValue.length === 1) {
                        genCode("node." + property + "[i] = match(node." + property + "[i],match);");
                    } else if (propertyValue.length === 2 && typeof propertyValue[1] === "object") {
                        var subpattern = propertyValue[1];
                        for (var subproperty in subpattern) {
                            // Match a single value
                            genCode("node." + property + "[i]." + subproperty + 
                                    " = match(node." + property + "[i]." + subproperty + ",match);");
                        }
                    }
                    genCode.decIndent();
                    genCode("}");
                } else {
                    throw new Error("Invalid property operation '" + propertyValue + "'");
                }
            } else {
                throw new Error("Invalid property operation '" + propertyValue + "'");
            }
        }

        genCode("return node;");
        genCode.decIndent();
    }

    genCode("default:");
    genCode.incIndent();
    genCode("return parentMatcher(node,match);");
    genCode.decIndent();

    genCode.decIndent();
    genCode("}");
    genCode.decIndent();

    genCode("}");

    var f = new Function (["parentMatcher"], genCode.getCode())(parentMatcher);
    return f;

}

function matchFailed(ast,match) {
    throw new Error("Match failed on node type '" + ast.type + "'");
}

var genericTraversal = createInplaceTraverser(matchFailed,[
    {   
        type: "Program",
        body: ["matchAll"]
    },
    {   type: "EmptyStatement"},
    {
        type: "BlockStatement",
        body: ["matchAll"]
    },{
        type: "ExpressionStatement",
        expression: ["match"]
    },{
        type: "IfStatement",
        test: ["match"],
        consequent: ["match"],
        alternate: ["match"]
    },{
        type: "LabeledStatement",
        label: ["match"],
        body: ["match"],
    },{
        type: "BreakStatement",
        label: ["match"]
    },{
        type: "ContinueStatement",
        label: ["match"],
    },{
        type: "WithStatement",
        object: ["match"],
        body: ["match"]
    },{
        type: "SwitchStatement",
        discriminant: ["match"],
        cases: ["matchAll"],
    },{
        type: "ReturnStatement",
        argument: ["match"]
    },{
        type: "ThrowStatement",
        argument: ["match"]
    },{
        type: "TryStatement",
        block: ["match"],
        handlers: ["matchAll"],
        guardedHandlers: ["matchAll"],
        finalizer: ["match"]
    },{
        type: "WhileStatement",
        test: ["match"],
        body: ["match"]
    },{
        type: "DoWhileStatement",
        body: ["match"],
        test: ["match"]
    },{
        type: "ForStatement",
        init: ["match"],
        test: ["match"],
        update: ["match"],
        body: ["match"]
    },{
        type: "ForInStatement",
        left: ["match"],
        right: ["match"],
        body: ["match"]
    },{ 
        type: "FunctionDeclaration",
        id: ["match"],
        defaults: ["matchAll"],
        body: ["match"]
    },{
        type: "VariableDeclaration",
        declarations: ["matchAll"]
    },{
        type: "VariableDeclarator",
        id: ["match"],
        init: ["match"]
    },{
        type: "ThisExpression"
    },{
        type: "ArrayExpression",
        elements: ["matchAll"]
    },{
        type: "ObjectExpression",
        properties: ["matchAll", {
            key: ["match"],
            value: ["match"]
        }],
    },{
        type: "FunctionExpression",
        id: ["match"],
        defaults: ["matchAll"],
        rest: ["match"],
        body: ["match"]
    },{
        type: "SequenceExpression",
        expressions: ["matchAll"],
    },{
        type: "UnaryExpression",
        argument: ["match"]
    },{
        type: "BinaryExpression",
        left: ["match"],
        right: ["match"]
    },{
        type: "AssignmentExpression",
        left: ["match"],
        right: ["match"],
    },{
        type: "UpdateExpression",
        argument: ["match"],
    },{
        type: "LogicalExpression",
        left: ["match"],
        right: ["match"]
    },{
        type: "ConditionalExpression",
        test: ["match"],
        alternate: ["match"],
        consequent: ["match"]
    },{
        type: "NewExpression",
        callee: ["match"],
        arguments: ["matchAll"]
    },{
        type: "CallExpression",
        callee: ["match"],
        arguments: ["matchAll"]
    },{
        type: "MemberExpression",
        object: ["match"],
        property: ["match"]
    },{
        type: "SwitchCase",
        test: ["match"],
        consequent: ["matchAll"]
    },{
        type: "CatchClause",
        param: ["match"],
        body: ["match"]
    },{ type: "Literal"},
    {   type: "Identifier"},
]);
