/* istanbul ignore file */
'use strict'

// Knex table migrations
exports.up = async knex => {
  await knex.raw( 'CREATE EXTENSION IF NOT EXISTS "pgcrypto"' )

  // Base table holding up some configuration variables for the server. Not really used much.
  await knex.schema.createTable( 'server_config', table => {
    table.integer( 'id' ).notNullable( ).defaultTo( 0 ).index( )
    table.string( 'name' ).defaultTo( 'My Speckle Server' )
    table.string( 'company' ).defaultTo( 'Acme. Inc.' )
    table.string( 'description' ).defaultTo( 'Speckle is the open source data platform for AEC.' )
    table.string( 'adminContact' ).defaultTo( 'n/a' )
    table.string( 'termsOfService' ).defaultTo( 'n/a' )
    table.string( 'canonicalUrl' )
    table.boolean( 'completed' ).defaultTo( false )
  } )

  // Users.
  await knex.schema.createTable( 'users', table => {
    table.string( 'id', 10 ).primary( )
    table.string( 'suuid' ).defaultTo( knex.raw( 'gen_random_uuid()' ) ).index( )
    table.timestamp( 'createdAt' ).defaultTo( knex.fn.now( ) )
    table.string( 'name', 256 ).notNullable( )
    table.string( 'bio', 1024 )
    table.string( 'company', 256 )
    table.string( 'email' ).unique( )
    table.bool( 'verified' ).defaultTo( false )
    table.text( 'avatar' )
    table.jsonb( 'profiles' )
    table.text( 'passwordDigest' ) // bcrypted pwd
  } )

  // Roles.
  // Roles keep track of their name and the target resource they are applied to.
  // The target resource must be a table name.
  // The heigher the weight, the bigger the permissions.
  await knex.schema.createTable( 'user_roles', table => {
    table.string( 'name' ).primary( )
    table.text( 'description' ).notNullable( )
    table.string( 'resourceTarget' ).notNullable( )
    table.string( 'aclTableName' ).notNullable( )
    table.integer( 'weight' ).defaultTo( 100 ).notNullable( )
  } )

  // Server-wide access control list.
  await knex.schema.createTable( 'server_acl', table => {
    table.string( 'userId', 10 ).references( 'id' ).inTable( 'users' ).primary( ).onDelete( 'cascade' )
    table.string( 'role' ).references( 'name' ).inTable( 'user_roles' ).notNullable( ).onDelete( 'cascade' )
  } )

  // Tokens.
  await knex.schema.createTable( 'api_tokens', table => {
    table.string( 'id', 10 ).primary( )
    table.string( 'tokenDigest' ).unique( )
    table.string( 'owner', 10 ).references( 'id' ).inTable( 'users' ).notNullable( ).onDelete( 'cascade' )
    table.string( 'name' )
    table.string( 'lastChars', 6 )
    table.boolean( 'revoked' ).defaultTo( false )
    table.bigint( 'lifespan' ).defaultTo( 3.154e+12 ) // defaults to a lifespan of 100 years
    table.timestamp( 'createdAt' ).defaultTo( knex.fn.now( ) )
    table.timestamp( 'lastUsed' ).defaultTo( knex.fn.now( ) )
  } )

  // Tokens generated directly by a user from an application.
  await knex.schema.createTable( 'personal_api_tokens', table => {
    table.string( 'tokenId' ).references( 'id' ).inTable( 'api_tokens' ).onDelete( 'cascade' )
    table.string( 'userId' ).references( 'id' ).inTable( 'users' ).onDelete( 'cascade' )
  } )

  // Registered application scopes table.
  // Scopes limit what a token can actually do.
  await knex.schema.createTable( 'scopes', table => {
    table.string( 'name' ).primary( )
    table.text( 'description' ).notNullable( )
  } )

  // Token >- -< Scopes junction table.
  await knex.schema.createTable( 'token_scopes', table => {
    table.string( 'tokenId' ).references( 'id' ).inTable( 'api_tokens' ).notNullable( ).onDelete( 'cascade' ).index( )
    table.string( 'scopeName' ).references( 'name' ).inTable( 'scopes' ).notNullable( ).onDelete( 'cascade' ).index( )
    table.index( [ 'tokenId', 'scopeName' ], 'token_scope_combined_idx' )
  } )

  // Streams table.
  await knex.schema.createTable( 'streams', table => {
    table.string( 'id', 10 ).primary( )
    table.string( 'name' ).notNullable( ).defaultTo( 'Unnamed Stream' )
    table.text( 'description' )
    table.boolean( 'isPublic' ).defaultTo( true )
    table.string( 'clonedFrom', 10 ).references( 'id' ).inTable( 'streams' )
    table.timestamp( 'createdAt' ).defaultTo( knex.fn.now( ) )
    table.timestamp( 'updatedAt' ).defaultTo( knex.fn.now( ) )
  } )

  // Stream-users access control list.
  // Controls ownership and permissions.
  await knex.schema.createTable( 'stream_acl', table => {
    table.string( 'userId', 10 ).references( 'id' ).inTable( 'users' ).notNullable( ).onDelete( 'cascade' )
    table.string( 'resourceId', 10 ).references( 'id' ).inTable( 'streams' ).notNullable( ).onDelete( 'cascade' )
    table.string( 'role' ).references( 'name' ).inTable( 'user_roles' ).notNullable( ).onDelete( 'cascade' )
    table.primary( [ 'userId', 'resourceId' ] )
    table.unique( [ 'userId', 'resourceId' ] )
  } )

  // Objects Table.
  // id - the object's *hash*
  // totalChildrenCount - how many subchildren, regardless of depth, this object has
  // totalChildrenCountByDepth - how many subchildren does this object have at a specific nesting depth.
  // createdAt - date of insertion
  // data - the full object stored as a jsonb representation.
  await knex.schema.createTable( 'objects', table => {
    table.string( 'id' ).primary( )
    table.string( 'speckleType', 255 ).defaultTo( 'Base' ).notNullable( )
    table.integer( 'totalChildrenCount' )
    table.jsonb( 'totalChildrenCountByDepth' )
    table.timestamp( 'createdAt' ).defaultTo( knex.fn.now( ) )
    table.jsonb( 'data' )
  } )

  // Closure table for tracking the nesting relationships of objects.
  // Note: the usecase optimised for is that when we request an object, we either:
  // a) interactively request/query for its subchildren (sequentially)
  // or
  // b) we want all of it!
  await knex.schema.createTable( 'object_children_closure', table => {
    table.string( 'parent' ).notNullable( ).index( )
    table.string( 'child' ).notNullable( ).index( )
    table.integer( 'minDepth' ).defaultTo( 1 ).notNullable( ).index( )
    table.unique( [ 'parent', 'child' ], 'obj_parent_child_index' )
    table.index( [ 'parent', 'minDepth' ], 'full_pcd_index' )
  } )

  // Commit table.
  // Any object can be "blessed" as a commit.
  await knex.schema.createTable( 'commits', table => {
    table.string( 'id', 10 ).primary( )
    table.string( 'referencedObject' ).references( 'id' ).inTable( 'objects' ).notNullable( )
    table.string( 'author', 10 ).references( 'id' ).inTable( 'users' ).notNullable( )
    table.string( 'message' ).defaultTo( 'no message' )
    table.timestamp( 'createdAt' ).defaultTo( knex.fn.now( ) )
  } )

  // Commit inheritance table.
  // Tracks the inheritance of commits. A commit may have:
  // - one ancestor (simple sequential push)
  // - more ancestors (result of a merge)
  await knex.schema.createTable( 'parent_commits', table => {
    table.string( 'parent', 10 ).references( 'id' ).inTable( 'commits' ).notNullable( ).onDelete( 'cascade' )
    table.string( 'child', 10 ).references( 'id' ).inTable( 'commits' ).notNullable( ).onDelete( 'cascade' )
    table.unique( [ 'parent', 'child' ], 'commit_parent_child_index' )
  } )

  // Branches table.
  // A branch is a end-user scope-bound collection of commits.
  await knex.schema.createTable( 'branches', table => {
    table.string( 'id', 10 ).primary( )
    table.string( 'streamId', 10 ).references( 'id' ).inTable( 'streams' ).notNullable( ).onDelete( 'cascade' )
    table.string( 'authorId', 10 ).references( 'id' ).inTable( 'users' )
    table.string( 'name' )
    table.text( 'description' )
    table.timestamp( 'createdAt' ).defaultTo( knex.fn.now( ) )
    table.timestamp( 'updatedAt' ).defaultTo( knex.fn.now( ) )
    table.unique( [ 'streamId', 'name' ] )
  } )

  // Junction Table Branches >- -< Commits
  await knex.schema.createTable( 'branch_commits', table => {
    table.string( 'branchId', 10 ).references( 'id' ).inTable( 'branches' ).notNullable( ).onDelete( 'cascade' )
    table.string( 'commitId' ).references( 'id' ).inTable( 'commits' ).notNullable( ).onDelete( 'cascade' )
    table.primary( [ 'branchId', 'commitId' ] )
  } )

  // Flat table to store all commits of a stream.
  // Added here to prevent a n+1 query (would happen if we'd rely to get all commits only from branches)
  await knex.schema.createTable( 'stream_commits', table => {
    table.string( 'streamId', 10 ).references( 'id' ).inTable( 'streams' ).notNullable( ).onDelete( 'cascade' )
    table.string( 'commitId' ).references( 'id' ).inTable( 'commits' ).notNullable( ).onDelete( 'cascade' )
    table.primary( [ 'streamId', 'commitId' ] )
  } )
}

exports.down = async knex => {
  await knex.schema.dropTableIfExists( 'server_config' )

  await knex.schema.dropTableIfExists( 'server_acl' )
  await knex.schema.dropTableIfExists( 'stream_acl' )
  await knex.schema.dropTableIfExists( 'user_roles' )

  await knex.schema.dropTableIfExists( 'stream_commits' )
  await knex.schema.dropTableIfExists( 'branch_commits' )
  await knex.schema.dropTableIfExists( 'branches' )
  await knex.schema.dropTableIfExists( 'parent_commits' )
  await knex.schema.dropTableIfExists( 'commits' )
  await knex.schema.dropTableIfExists( 'object_children_closure' )

  await knex.schema.dropTableIfExists( 'objects' )
  await knex.schema.dropTableIfExists( 'streams' )

  await knex.schema.dropTableIfExists( 'token_scopes' )
  await knex.schema.dropTableIfExists( 'scopes' )
  await knex.schema.dropTableIfExists( 'personal_api_tokens' )
  await knex.schema.dropTableIfExists( 'api_tokens' )
  await knex.schema.dropTableIfExists( 'users' )

  await knex.raw( `DROP TYPE IF EXISTS speckle_reference_type ` )
  await knex.raw( `DROP TYPE IF EXISTS speckle_acl_role_type ` )
}
