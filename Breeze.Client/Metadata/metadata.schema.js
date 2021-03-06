var x = {
    "title": "Breeze Metadata Schema",
    "type": "object",
    "properties": {
        "metadataVersion": {
            "description": "The serialization version for this document",
            "type": "string"
        },
        "namingConvention": {
            "description": "On deserialization, this must match the name of some 'namingConvention' already registered on the breeze client.",
            "type": "string"
        },
        "localQueryComparisonOptions": {
            "description": "On deserialization, this must match the name of some 'localQueryComparisonOptions' already registered on the breeze client.",
            "type": "string"
        },
        "dataServices": {
            "type": "array",
            "items": {
                "$ref": "#/definitions/dataService"
            }
        },
        "structuralTypes": {
            "description": "Array of entity and complex types",
            "type": "array",
            "items": {
                "oneOf": [ 
                    { "$ref": "#/definitions/entityType" }, 
                    { "$ref": "#/definitions/complexType" }
                ]
            }
        },
        "resourceEntityTypeMap": {
            "description": "Map of resource names to entity type names.",
            "type": "object",
            "additionalProperties": {
                "description": "Fully qualified Entity type names.",
                "$ref": "#/definitions/structuralTypeName"
            }
        }
    },
    "required": [
        "structuralTypes"
    ],
    "additionalProperties": true,
    "definitions": {
        "structuralTypeName": {
            "description": "A fully qualified entity or complex type name - constructed as 'shortName' + ':#' + 'namespace'",
            "type": "string",
            "pattern": "\\S+:#\\S*"
        },
        "entityType": {
            "properties": {
                "shortName": {
                    "description": "Together the shortName and the namespace make up a fully qualified name.  Within this metadata references to an entityType are all qualified references. See the 'structuralTypeName' definition.instanceof in this document.",
                    "type": "string"
                },
                "namespace": {
                    "type": "string",
                    "default": ""
                },
                "autoGeneratedKeyType": {
                    "description": "Defines the mechanism by which the key for entities of this type are determined on the server.  'None' means that the client sets the key.",
                    "enum": [
                        "Identity",
                        "None",
                        "KeyGenerator"
                    ],
                    "default": "None"
                },
                "defaultResourceName": {
                    "description": "The default name by which entities of this type will be queried.  Multipe 'resourceNames' may query for the same entityType, (see the 'resourceEntityTypeMap') but only one is the default.",
                    "type": "string"
                },
                "dataProperties": {
                    "type": "array",
                    "items": {
                        "$ref": "#/definitions/dataProperty"
                    },
                    "uniqueItems": true
                },
                "navigationProperties": {
                    "type": "array",
                    "items": {
                        "$ref": "#/definitions/navigationProperty"
                    },
                    "uniqueItems": true
                }
            },
            "required": [
                "shortName",
                "autoGeneratedKeyType",
                "dataProperties"
            ]
        },
        "complexType": {
            "properties": {
                "shortName": {
                    "description": "Together the shortName and the namespace make up a fully qualified name.  Within this metadata references to an entityType are all qualified references. See the 'structuralTypeName' definition.instanceof in this document.",
                    "type": "string"
                },
                "namespace": {
                    "type": "string",
                    "default": ""
                },
                "isCompleType": {
                    "description": "This must be 'true'.  This field is what distinguishes an entityType from a complexType. ",
                    "type": "boolean"
                },
                "dataProperties": {
                    "type": "array",
                    "items": {
                        "$ref": "#/definitions/dataProperty"
                    },
                    "uniqueItems": true
                }
            },
            "required": [
                "shortName",
                "dataProperties"
            ]
        },
        "dataProperty": {
            "description": "A single data property, at a minimum you must to define either a 'name' or a 'nameOnServer' and either a 'dataType' or a 'complexTypeName'.",
            "properties": {
                "name": {
                    "description": "The client side name of this property.",
                    "type": "string"
                },
                "nameOnServer": {
                    "description": "The server side side name of this property. Either name or nameOnServer must be specified and either is sufficient.",
                    "type": "string"
                },
                "dataType": {
                    "description": "If present, the complexType name should be omitted.",
                    "enum": [
                        "String",
                        "Int16",
                        "Int32",
                        "Int64",
                        "Single",
                        "Double",
                        "Decimal",
                        "DateTime",
                        "DateTimeOffset",
                        "Time",
                        "Boolean",
                        "Guid",
                        "Byte",
                        "Binary",
                        "Undefined"
                    ],
                    "default": "String"
                },
                "complexTypeName": {
                    "description": "If present, this must be the fully qualified name of one of the 'complexTypes' defined within this document, and the 'dataType' property may be omitted",
                    "$ref": "#/definitions/structuralTypeName"
                },
                "isNullable": {
                    "description": "Whether a null can be assigned to this property.",
                    "type": "boolean",
                    "default": true
                },
                "defaultValue": {
                    "description": "The default value for this property if nothing is assigned to it.",
                    "type": "object"
                },
                "isPartOfKey": {
                    "description": "Whether this property is part of the key for this entity type",
                    "type": "boolean",
                    "default": false
                },
                "concurrencyMode": {
                    "description": "This determines whether this property is used for concurreny purposes.",
                    "enum": [
                        "Fixed",
                        "None"
                    ],
                    "default": "None"
                },
                "maxLength": {
                    "description": "Only applicable to 'String' properties. This is the maximum string length allowed.",
                    "type": "number"
                },
                "validators": {
                    "description": "A list of the validators (validations) that will be associated with this property",
                    "type": "array",
                    "items": {
                        "$ref": "#/definitions/validator"
                    },
                    "uniqueItems": true
                }
            }
        },
        "navigationProperty": {
            "description": "A single navigation property, at a minimum you must to define the 'required' properties defined below AS WELL AS either a 'name' or a 'nameOnServer'..",
            "properties": {
                "name": {
                    "description": "The client side name of this property.",
                    "type": "string"
                },
                "nameOnServer": {
                    "description": "The server side side name of this property. Either name or nameOnServer must be specified and either is sufficient.",
                    "type": "string"
                },
                "entityTypeName": {
                    "description": "The type of the entity or collection of entities returned by this property.",
                    "$ref": "#/definitions/structuralTypeName"
                },
                "isScalar": {
                    "description": "Whether this property returns a single entity (true) or an array of entities (false).",
                    "type": "boolean"
                },
                "associationName": {
                    "description": "An arbitrary name that is used to link this navigation property to its inverse property. For bidirectional navigations this name will occur twice within this document, otherwise only once.",
                    "type": "string"
                },
                "foreignKeyNames": {
                    "description": "An array of the names of the properties on this type that are the foreign key 'backing' for this navigation property.  This may only be set if 'isScalar' is true.",
                    "type": "array",
                    "items": {
                        "type": "string"
                    }
                },
                "foreignKeyNamesOnServer": {
                    "description": "Same as above, but the names here are server side names as opposed to client side.  Only one or the other is needed.",
                    "type": "array",
                    "items": {
                        "type": "string"
                    }
                },
                "validators": {
                    "description": "A list of the validators (validations) that will be associated with this property",
                    "type": "array",
                    "items": {
                        "$ref": "#/definitions/validator"
                    },
                    "uniqueItems": true
                }
            },
            "required": [
                "entityTypeName",
                "isScalar",
                "associationName"
            ]
        },
        "dataService": {
            "properties": {
                "serviceName": {
                    "type": "string"
                },
                "adapterName": {
                    "description": "On deserialization, this must match the name of some 'dataService adapter' already registered on the breeze client.",
                    "type": "string"
                },
                "hasServerMetadata": {
                    "type": "boolean",
                    "default": true
                },
                "jsonResultsAdapter": {
                    "description": "On deserialization, this must match the name of some jsonResultsAdapter registered on the breeze client.",
                    "type": "string"
                }
            },
            "required": [
                "serviceName"
            ]
        },
        "validator": {
            "properties": {
                "name": {
                    "description": "On deserialization, this must match the name of some validator already registered on the breeze client.",
                    "type": "string"
                }
            },
            "additionalProperties": true,
            "required": [
                "name"
            ]
        }
    }
}