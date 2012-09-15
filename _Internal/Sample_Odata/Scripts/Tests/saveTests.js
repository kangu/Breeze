require.config({ baseUrl: "Scripts/IBlade" });

define(["testFns"], function (testFns) {
    var root = testFns.root;
    var core = root.core;
    var entityModel = root.entityModel;

    var Enum = core.Enum;

    var MetadataStore = entityModel.MetadataStore;
    var EntityManager = entityModel.EntityManager;
    var AutoGeneratedKeyType = entityModel.AutoGeneratedKeyType;
    var SaveOptions = entityModel.SaveOptions;
    var EntityQuery = entityModel.EntityQuery;
    var EntityKey = entityModel.EntityKey;
    var EntityState = entityModel.EntityState;
    var FilterQueryOp = entityModel.FilterQueryOp;

    var newMs = function() {
        var ms = new MetadataStore({
            namingConventions: {
                serverPropertyNameToClient: function(serverPropertyName) {
                    return serverPropertyName.substr(0, 1).toLowerCase() + serverPropertyName.substr(1);
                },
                clientPropertyNameToServer: function(clientPropertyName) {
                    return clientPropertyName.substr(0, 1).toUpperCase() + clientPropertyName.substr(1);
                }            
            }
        });
        return ms;
    };
    
    var metadataStore = newMs();
        var newEm = function () {
        return new EntityManager({ serviceName: testFns.ServiceName, metadataStore: metadataStore });
    };


    module("save", {
        setup: function () {
            if (!metadataStore.isEmpty()) return;
            stop();
            var em = newEm();
            em.fetchMetadata(function (rawMetadata) {
                var isEmptyMetadata = metadataStore.isEmpty();
                ok(!isEmptyMetadata);
                this.regionType = metadataStore.getEntityType("Region");
                regionType.autoGeneratedKeyType = AutoGeneratedKeyType.KeyGenerator;
                this.territoryType = metadataStore.getEntityType("Territory");
                territoryType.autoGeneratedKeyType = AutoGeneratedKeyType.KeyGenerator;
                start();
            });
        },
        teardown: function () {

        }
    });

    test("noop", function() {
        var em = newEm();
        var q = new EntityQuery("Customers");
        stop();
        q.using(em).execute().then(function(data) {
            return em.saveChanges();
        }).then(function (sr) {
            ok(Array.isArray(sr.entities));
            ok(sr.entities.length == 0);
            start();
        }).fail(testFns.handleFail);
    });

    test("unmapped save", function() {

        // use a different metadata store for this em - so we don't polute other tests
        var em1 = newEm();
        var Customer = function() {
            this.miscData = "asdf";
        };


        em1.metadataStore.registerEntityTypeCtor("Customer", Customer);
        stop();
        var q = new EntityQuery("Customers")
            .where("CompanyName", "startsWith", "C");
        q.using(em1).execute().then(function(data) {
            var customers = data.results;
            customers.every(function(c) {
                ok(c.getProperty("miscData") == "asdf", "miscData should == 'asdf'");

            });
            var cust = customers[0];
            cust.setProperty("miscData", "xxx");
            ok(cust.entityAspect.entityState == EntityState.Modified);
            return em1.saveChanges();

        }).then(function(sr) {
            var saved = sr.entities;
            ok(saved.length === 1);
            start();
        }).fail(testFns.handleFail);
    });
    
    test("add parent and children", function () {
        var em = newEm();
        var zzz = createParentAndChildren(em);
        stop();
        em.saveChanges(null, null,
            function(saveResult) {
                ok(zzz.cust1.entityAspect.entityState.isUnchanged());
                ok(zzz.cust2.entityAspect.entityState.isUnchanged());
                ok(zzz.order1.entityAspect.entityState.isUnchanged());
                ok(zzz.order2.entityAspect.entityState.isUnchanged());
                ok(zzz.cust1.getProperty("CustomerID") != zzz.keyValues[0]);
                ok(zzz.cust2.getProperty("CustomerID") != zzz.keyValues[1]);
                ok(zzz.order1.getProperty("OrderID") != zzz.keyValues[2]);
                ok(zzz.order2.getProperty("OrderID") != zzz.keyValues[3]);
                ok(zzz.order1.getProperty("Customer") === zzz.cust1);
                ok(zzz.order2.getProperty("Customer") === zzz.cust1);
                ok(zzz.cust1.getProperty("Orders").length === 2);
                ok(zzz.cust2.getProperty("Orders").length === 0);
                start();
            }, function(err) {
                ok(false, "should not get here - " + err);
                start();
            }).fail(testFns.handleFail);
    });

    test("allow concurrent saves with concurrency column", 2, function() {
        var em = newEm();
        em.saveOptions = new SaveOptions({ allowConcurrentSaves: true });
        var q = new EntityQuery()
            .from("Customers")
            .take(2);
        stop();
        
        var cust;
        var savedCount = 0;
        
        function handleSaveResult(sr) {
            savedCount = savedCount + 1;
            if (savedCount == 1) {
                ok(true, "should have gotten here");
                return;
            }
            if (savedCount == 2) {
                ok(false, "second fail should have failed");
            }
        }
        
        function handleFailResult(err) {
            var msg = err.message;
            if ( msg.indexOf("Store update, insert")>=0) {
                ok(true, "should also have gotten here");
                start();
            } else {
                ok(false, "should not get here: " + msg);
                start();
            }
        }

        em.executeQuery(q).then(function(data) {
            // query cust
            cust = data.results[0];
            testFns.morphStringProp(cust, "CompanyName");
            
            em.saveChanges().then(function(sr) {
                handleSaveResult(sr);
            }).fail(function (e) {
                handleFailResult(e);
            });
            em.saveChanges().then(function(sr) {
                handleSaveResult(sr);
            }).fail(function (e) {
                handleFailResult(e);
            });
        });
    });
    
    test("allow concurrent saves with NO concurrency column", 2, function() {
        var em = newEm();
        em.saveOptions = new SaveOptions({ allowConcurrentSaves: true });
        var q = new EntityQuery()
            .from("Products")
            .take(2);

        stop();
        var prod;
        
        var savedCount = 0;
        
        function handleSaveResult(sr) {
            savedCount = savedCount + 1;
            if (savedCount == 1) {
                ok(true, "should have gotten here");
                return;
            }
            if (savedCount == 2) {
                ok(true, "this is good");
                start();
            }
        }
        
        function handleFailResult(err) {
            var msg = err.message;
            ok(false, "should not get here: " + msg);
            start();
        }


        em.executeQuery(q).then(function(data) {
            // query cust
            prod = data.results[0];
            var price = prod.getProperty("UnitPrice");
            prod.setProperty("UnitPrice", price + .01);
            
            em.saveChanges().then(function(sr) {
                handleSaveResult(sr);
            }).fail(function (e) {
                handleFailResult(e);
            });
            em.saveChanges().then(function(sr) {
                handleSaveResult(sr);
            }).fail(function (e) {
                handleFailResult(e);
            });
        });
    });
    
    test("disallow concurrent saves with NO concurrency column",2, function() {
        var em = newEm();
        // Next line is not needed because it is the default
        // em.saveOptions = new SaveOptions({ allowConcurrentSaves: false });
        var q = new EntityQuery()
            .from("Products")
            .take(2);

        stop();
        var prod;
        
        var savedCount = 0;
        var failedCount = 0;
        
        function handleSaveResult(sr) {
            savedCount = savedCount + 1;
            if (savedCount == 1) {
                ok(true, "should have gotten here");
                if (failedCount == 1) {
                    start();
                }
                return;
            }
            if (savedCount == 2) {
                ok(false, "second fail should have failed");
                start();
            }
        }
        
        function handleFailResult(err) {
            failedCount = failedCount + 1;
            var msg = err.message;
            if ( msg.indexOf("allowConcurrentSaves")>=0) {
                ok(true, "should also have gotten here");
                if (savedCount == 1) {
                    start();
                }
            } else {
                ok(false, "should not get here: " + msg);
                start();
            }
        }

        em.executeQuery(q).then(function(data) {
            // query cust
            prod = data.results[0];
            var price = prod.getProperty("UnitPrice");
            prod.setProperty("UnitPrice", price + .01);
            
            em.saveChanges().then(function(sr) {
                handleSaveResult(sr);
            }).fail(function (e) {
                handleFailResult(e);
            });
            em.saveChanges().then(function(sr) {
                handleSaveResult(sr);
            }).fail(function (e) {
                handleFailResult(e);
            });
        });
    });

    test("modify one", function () {
        var em = newEm();
        var query = new EntityQuery()
            .from("Customers")
            .where("CompanyName", "startsWith", "C")
            .take(2);
        stop();
        em.executeQuery(query, function (data) {
            var cust = data.results[0];
            var orders = cust.getProperty("Orders");
            var companyName = cust.getProperty("CompanyName");
            var newCompanyName = testFns.morphString(companyName);
            cust.setProperty("CompanyName", newCompanyName);
            em.saveChanges(null, null, function (saveResult) {
                var entities = saveResult.entities;
                ok(entities.length === 1);
                ok(saveResult.keyMappings.length === 0);
                ok(entities[0] === cust);
                ok(cust.getProperty("CompanyName") === newCompanyName);
                ok(cust.entityAspect.entityState.isUnchanged());
                var q2 = EntityQuery.fromEntities(cust);
                em.executeQuery(q2, function (data2) {
                    var entities2 = data2.results;
                    ok(entities2.length === 1);
                    ok(entities2[0] === cust);
                    ok(cust.getProperty("CompanyName") === newCompanyName);
                    start();
                }, testFns.handleFail);
            }, testFns.handleFail);
        }, testFns.handleFail);
    });

    test("modify parent and children", function () {
        var em = newEm();
        var query = new EntityQuery()
            .from("CustomersAndOrders")
            .where("CompanyName", "startsWith", "C")
            .take(5);
        stop();
        em.executeQuery(query, function (data) {
            var cust = core.arrayFirst(data.results, function (c) {
                return c.getProperty("Orders").length > 0;
            });
            ok(cust, "unable to find a customer with orders");

            var companyName = cust.getProperty("CompanyName");
            var newCompanyName = testFns.morphStringProp(cust, "CompanyName");
            ok(cust.entityAspect.entityState.isModified(), "should be modified");
            var orders = cust.getProperty("Orders");
            orders.forEach(function (o) {
                testFns.morphStringProp(o, "ShipName");
                ok(o.entityAspect.entityState.isModified(), "should be modified");
            });
            em.saveChanges(null, null, function (saveResult) {
                var entities = saveResult.entities;
                ok(entities.length === 1 + orders.length, "wrong number of entities returned");
                ok(saveResult.keyMappings.length === 0, "no key mappings should be returned");

                entities.forEach(function (e) {
                    ok(e.entityAspect.entityState.isUnchanged, "entity is not in unchanged state");
                    if (e.entityType === cust.entityType) {
                        ok(e === cust, "cust does not match");
                    } else {
                        ok(orders.indexOf(e) >= 0, "order does not match");
                    }
                });

                ok(cust.getProperty("CompanyName") === newCompanyName, "company name was not changed");
                ok(cust.entityAspect.entityState.isUnchanged(), "entityState should be unchanged");
                var q2 = EntityQuery.fromEntities(cust);

                em.executeQuery(q2, function (data2) {
                    var entities2 = data2.results;
                    ok(entities2.length === 1, "should only get a single entity");
                    ok(entities2[0] === cust, "requery does not match cust");
                    ok(cust.getProperty("CompanyName") === newCompanyName, "company name was not changed on requery");
                    start();
                }).fail(testFns.handleFail);
            }).fail(testFns.handleFail);
        });
    });

    test("delete parent, children stranded", function () {
        var em = newEm();
        var zzz = createParentAndChildren(em);
        stop();
        em.saveChanges(null, null, function (saveResult) {

            zzz.cust1.entityAspect.setDeleted();
            em.saveChanges(null, null, function (sr) {
                ok(false, "shouldn't get here");
                start();
            }).fail(function (error) {
                ok(error instanceof Error, "should be an error");
                ok(error.message.indexOf("FOREIGN KEY") >= 0, "message should contain 'FOREIGN KEY'");
                start();
            });
        }).fail(testFns.handleFail);
    });

    test("delete parent then delete children", function () {
        var em = newEm();
        var zzz = createParentAndChildren(em);
        stop();
        em.saveChanges(null, null, function (saveResult) {
            zzz.cust1.entityAspect.setDeleted();
            zzz.order1.entityAspect.setDeleted();
            zzz.order2.entityAspect.setDeleted();
            ok(zzz.order1.entityAspect.entityState.isDeleted(), "should be marked as deleted");
            ok(zzz.cust1.entityAspect.entityState.isDeleted(), "should be marked as deleted");
            em.saveChanges(null, null, function (sr) {
                ok(sr.entities.length === 3, "should be 3 entities saved");
                ok(zzz.order1.entityAspect.entityState.isDetached(), "order1 should be marked as detached");
                ok(zzz.order2.entityAspect.entityState.isDetached(), "order2 should be marked as detached");
                ok(zzz.cust1.entityAspect.entityState.isDetached(), "cust1 should be marked as detached");
                start();
            }).fail(testFns.handleFail);
        }).fail(testFns.handleFail);
    });

    test("delete children then delete parent", function () {
        var em = newEm();
        var zzz = createParentAndChildren(em);
        stop();
        em.saveChanges().then(function (saveResult) {
            var orders = zzz.cust1.getProperty("Orders");
            ok(zzz.order1 === orders[0]);
            var cust1a = zzz.order1.getProperty("Customer");
            ok(cust1a === zzz.cust1);


            zzz.order1.entityAspect.setDeleted();
            zzz.order2.entityAspect.setDeleted();
            zzz.cust1.entityAspect.setDeleted();
            ok(zzz.order1.entityAspect.entityState.isDeleted(), "should be marked as deleted");
            ok(zzz.cust1.entityAspect.entityState.isDeleted(), "should be marked as deleted");
            return em.saveChanges();
        }).then(function (sr) {
            ok(sr.entities.length === 3, "should be 3 entities saved");
            ok(zzz.order1.entityAspect.entityState.isDetached(), "order1 should be marked as detached");
            ok(zzz.order2.entityAspect.entityState.isDetached(), "order2 should be marked as detached");
            ok(zzz.cust1.entityAspect.entityState.isDetached(), "cust1 should be marked as detached");
            start();
        }).fail(testFns.handleFail);
    });
    
    test("delete children then delete parent after query", function () {
        var em = newEm();
        var em2 = newEm();
        var zzz = createParentAndChildren(em);
        stop();
        em.saveChanges().then(function (saveResult) {
            var q = EntityQuery.fromEntities(zzz.cust1);
            q = EntityQuery.from("CustomersAndOrders").where(q.wherePredicate);
            return em2.executeQuery(q);
        }).then(function (data) {
            var cust = data.results[0];
            var orders = cust.getProperty("Orders").slice(0);
            orders.forEach(function(o) {
                o.entityAspect.setDeleted();
            });
            cust.entityAspect.setDeleted();
            ok(orders[0].entityAspect.entityState.isDeleted(), "should be marked as deleted");
            ok(cust.entityAspect.entityState.isDeleted(), "should be marked as deleted");
            return em2.saveChanges();
        }).then(function (sr) {
            ok(sr.entities.length === 3, "should be 3 entities saved");
            sr.entities.forEach(function(e) {
                ok(e.entityAspect.entityState.isDetached(), "entity should be marked as detached");
            });
            start();
        }).fail(testFns.handleFail);
    });

    test("delete children, leave parent alone", function () {
        var em = newEm();
        var zzz = createParentAndChildren(em);
        stop();
        em.saveChanges(null, null, function (saveResult) {

            zzz.order1.entityAspect.setDeleted();

            ok(zzz.cust1.getProperty("Orders").length === 1, "should only be 1 order now");
            zzz.order2.entityAspect.setDeleted();
            ok(zzz.cust1.getProperty("Orders").length === 0, "should be no orders now");
            ok(zzz.order1.entityAspect.entityState.isDeleted(), "should be marked as deleted");
            ok(zzz.cust1.entityAspect.entityState.isUnchanged(), "should be unchanged");
            em.saveChanges(null, null, function (sr) {
                ok(zzz.order1.entityAspect.entityState.isDetached(), "should be marked as detached");
                ok(zzz.cust1.getProperty("Orders").length === 0, "should be no orders now");
                start();
            }).fail(testFns.handleFail);
        }).fail(testFns.handleFail);
    });

    test("delete parent, move children", function () {
        var em = newEm();
        var zzz = createParentAndChildren(em);
        stop();
        em.saveChanges().then(function (saveResult) {

            zzz.cust1.entityAspect.setDeleted();
            zzz.order1.setProperty("Customer", zzz.cust2);
            ok(zzz.order1.entityAspect.entityState.isModified(), "should be marked as modified");
            zzz.order2.setProperty("Customer", zzz.cust2);
            ok(zzz.cust1.entityAspect.entityState.isDeleted(), "should be marked as deleted");

            em.saveChanges(null, null, function (sr2) {
                ok(sr2.entities.length === 3);
                ok(zzz.cust1.entityAspect.entityState.isDetached(), "should be marked as detached");
                ok(zzz.order1.entityAspect.entityState.isUnchanged(), "should be marked as unchanged");
                start();
            }).fail(testFns.handleFail);
        }).fail(testFns.handleFail);
    });

    test("concurrency violation", function () {
        var em = newEm();
        var em2 = newEm();
        var q = new EntityQuery()
            .from("Customers")
            .take(2);

        stop();
        var cust;
        var sameCust;
        em.executeQuery(q).then(function (data) {
            // query cust
            cust = data.results[0];
            var q2 = EntityQuery.fromEntities(cust);
            return em2.executeQuery(q2);
        }).then(function (data2) {
            // query same cust in dif em
            // and modify it and resave it
            ok(data2.results.length == 1, "should only have 1 result");
            sameCust = data2.results[0];
            ok(cust.entityAspect.getKey().equals(sameCust.entityAspect.getKey()), "should be the same key");
            testFns.morphStringProp(sameCust, "CompanyName");
            return em2.saveChanges();
        }).then(function (sr2) {
            testFns.morphStringProp(cust, "CompanyName");
            return em.saveChanges();
        }).then(function (sr2) {
            ok(false, "should not get here, save should have failed");
            start();
        }, function (error) {
            ok(error.detail.ExceptionType.toLowerCase().indexOf("concurrency") >= 0, "wrong error message: " + error.detail.ExceptionType);
            start();
        }).fail(testFns.handleFail);
    });
    
    test("concurrency violation on delete", function () {
        ok(false, "not yet implemented");
    });

    test("insert of existing entity", function () {
        var em = newEm();
        var q = new EntityQuery()
            .from("OrderDetails")
            .take(2);

        stop();
        em.executeQuery(q).then(function (data) {
            var od = data.results[0];
            em.detachEntity(od);
            var em2 = newEm();
            em2.addEntity(od);
            return em2.saveChanges();
        }).then(function (sr) {
            ok(false, "shouldn't get here");
            start();
        }, function (error) {
            ok(error.message.toLowerCase().indexOf("primary key constraint") >= 0, "wrong error message");
            start();
        }).fail(testFns.handleFail);
    });

    test("insert with generated key", function () {
        var em = newEm();

        var region1 = createRegion(em, "1");
        var k1 = region1.entityAspect.getKey();

        var region2 = createRegion(em, "2");
        var k2 = region2.entityAspect.getKey();

        stop();
        em.saveChanges().then(function (data) {
            ok(data.entities.length === 2);
            ok(!region1.entityAspect.getKey().equals(k1));
            ok(!region2.entityAspect.getKey().equals(k2));
            return data;
        }).then(function (data2) {
            // curious about synchronous results
            ok(data2.entities.length == 2);
            start();
        }).fail(testFns.handleFail);
    });

    test("insert with relationships with generated key", function () {
        var em = newEm();

        var region1 = createRegion(em, "1");
        var k1 = region1.entityAspect.getKey();
        var terrs1 = region1.getProperty("Territories");
        var terr1a = createTerritory(em, "1a");
        var terr1b = createTerritory(em, "1b");
        terrs1.push(terr1a);
        terrs1.push(terr1b);

        var region2 = createRegion(em, "2");
        var k2 = region2.entityAspect.getKey();
        var terrs2 = region2.getProperty("Territories");
        var terr2a = createTerritory(em, "1a");
        var terr2b = createTerritory(em, "1b");
        terrs2.push(terr2a);
        terrs2.push(terr2b);

        stop();
        em.saveChanges().then(function (data) {
            ok(data.entities.length === 6);
            ok(!region1.entityAspect.getKey().equals(k1));
            var terrs1x = region1.getProperty("Territories");
            ok(terrs1x === terrs1);
            ok(terrs1x.length == 2);
            ok(!region2.entityAspect.getKey().equals(k2));
            var terrs2x = region2.getProperty("Territories");
            ok(terrs2x === terrs2);
            ok(terrs2x.length == 2);
            ok(terrs2x[0].getProperty("Region") === region2);
            start();
        }).fail(testFns.handleFail);
    });

    test("bad save call", function () {
        var em = newEm();
        try {
            em.saveChanges(null, new SaveOptions(), "adfa");
        } catch (e) {
            ok(e.message.indexOf("callback") >= 0);
        }
        try {
            em.saveChanges(null, "adfa");
        } catch (e) {
            ok(e.message.indexOf("SaveOptions") >= 0);
        }
        try {
            em.saveChanges("adfa");
        } catch (e) {
            ok(e.message.indexOf("entities") >= 0);
        }

    });

    test("cleanup  test data", function() {
        var em = newEm();
        var q = EntityQuery.from("CustomersAndOrders")
            .where("CompanyName", FilterQueryOp.StartsWith, "Test");
        stop();
        em.executeQuery(q).then(function(data) {
            data.results.forEach(function(cust) {
                var orders = cust.getProperty("Orders").slice(0);
                orders.forEach(function(order) {
                    order.entityAspect.setDeleted();
                });
                cust.entityAspect.setDeleted();
            });
            return em.saveChanges();
        }).then(function(sr) {
            ok(sr, "save failed");
            ok(sr.entities.length, "deleted count:" + sr.entities.length);
            start();
        }).fail(testFns.handleFail);
    });

    function createParentAndChildren(em) {
        var custType = metadataStore.getEntityType("Customer");
        var orderType = metadataStore.getEntityType("Order");
        var cust1 = custType.createEntity();
        cust1.setProperty("CompanyName", "Test_js_1");
        cust1.setProperty("City", "Oakland");
        cust1.setProperty("RowVersion", 13);
        cust1.setProperty("Fax", "510 999-9999");
        var cust2 = custType.createEntity();
        cust2.setProperty("CompanyName", "Test_js_2");
        cust2.setProperty("City", "Emeryville");
        cust2.setProperty("RowVersion", 1);
        cust2.setProperty("Fax", "510 888-8888");
        em.addEntity(cust1);
        em.addEntity(cust2);
        var order1 = orderType.createEntity();
        var order2 = orderType.createEntity();
        var orders = cust1.getProperty("Orders");
        orders.push(order1);
        orders.push(order2);
        var keyValues = [cust1.getProperty("CustomerID"),
            cust2.getProperty("CustomerID"),
            order1.getProperty("OrderID"),
            order2.getProperty("OrderID")];
        return {
            cust1: cust1,
            cust2: cust2,
            order1: order1,
            order2: order2,
            keyValues: keyValues
        };
    }

    function createRegion(em, descr) {
        var region = this.regionType.createEntity();
        region.setProperty("RegionDescription", "Test-" + descr + "-" + new Date().toDateString());
        em.addEntity(region);
        return region;
    }

    function createTerritory(em, descr) {
        var territory = this.territoryType.createEntity();
        territory.setProperty("TerritoryDescription", "Test-" + descr + "-" + new Date().toDateString());
        em.addEntity(territory);
        return territory;
    }

    return testFns;
});