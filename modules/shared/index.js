'use strict'
const { ForbiddenError, ApolloError } = require( 'apollo-server-express' )
const { RedisPubSub } = require( 'graphql-redis-subscriptions' )
const Redis = require( 'ioredis' )
const debug = require( 'debug' )( 'speckle:middleware' )
const appRoot = require( 'app-root-path' )
const knex = require( `${appRoot}/db/knex` )
const { validateToken } = require( `${appRoot}/modules/core/services/tokens` )


let pubsub = new RedisPubSub( {
  publisher: new Redis( process.env.REDIS_URL ),
  subscriber: new Redis( process.env.REDIS_URL ),
} )


/*

    Graphql server context helper

 */

async function contextApiTokenHelper( { req, res, connection } ) {
  let token = null

  if ( connection && connection.context.token ) { // Websockets (subscriptions)
    token = connection.context.token
  } else if ( req && req.headers.authorization ) { // Standard http
    token = req.headers.authorization
  }

  if ( token && token.includes( "Bearer " ) ) {
    token = token.split( " " )[ 1 ]
  }

  if ( token === null )
    return { auth: false }


  try {
    let { valid, scopes, userId, role } = await validateToken( token )

    if ( !valid ) {
      return { auth: false }
    }

    return { auth: true, userId, role, token, scopes }
  } catch ( e ) {
    // TODO: Think wether perhaps it's better to throw the error
    return { auth: false, err: e }
  }

  return { auth: false }
}

// Middleware wrapper around the contextApiTokenHelper to be used in express routes
async function contextMiddleware( req, res, next ) {
  let result = await contextApiTokenHelper( { req, res } )
  req.context = result
  next( )
}

/*

    Keeps track of all the available roles on this server. It's seeded by the methods below.

 */
let roles

/*

    Validates a user's server-bound role (admin, normal user, etc.)

 */

async function validateServerRole( context, requiredRole ) {
  if ( !roles )
    roles = await knex( 'user_roles' ).select( '*' )

  if ( !context.auth ) throw new ForbiddenError( 'You must provide an auth token.' )
  if ( context.role === 'server:admin' ) return true

  let role = roles.find( r => r.name === requiredRole )
  let myRole = roles.find( r => r.name === context.role )

  if ( role === null ) new ApolloError( 'Invalid server role specified' )
  if ( myRole === null ) new ForbiddenError( 'You do not have the required server role (null)' )
  if ( myRole.weight >= role.weight )
    return true
  else
    throw new ForbiddenError( 'You do not have the required server role' )
}

/*

    Graphql scope validator

 */

async function validateScopes( scopes, scope ) {
  if ( !scopes )
    throw new ForbiddenError( 'You do not have the required privileges.' )
  if ( scopes.indexOf( scope ) === -1 && scopes.indexOf( '*' ) === -1 )
    throw new ForbiddenError( 'You do not have the required privileges.' )
}

/*

    Graphql authorization: checks user id against access control lists

 */

async function authorizeResolver( userId, resourceId, requiredRole ) {
  if ( !roles )
    roles = await knex( 'user_roles' ).select( '*' )

  // TODO: Cache these results with a TTL of 1 mins or so, it's pointless to query the db every time we get a ping.

  let role = roles.find( r => r.name === requiredRole )

  if ( role === undefined || role === null ) throw new ApolloError( 'Unknown role: ' + requiredRole )

  try {
    let { isPublic } = await knex( role.resourceTarget ).select( 'isPublic' ).where( { id: resourceId } ).first( )
    if ( isPublic && roles[ requiredRole ] < 200 ) return true
  } catch ( e ) {
    throw new ApolloError( `Resource of type ${role.resourceTarget} with ${resourceId} not found` )
  }

  let userAclEntry = await knex( role.aclTableName ).select( '*' ).where( { resourceId: resourceId, userId: userId } ).first( )

  if ( !userAclEntry ) throw new ForbiddenError( 'You do not have access to this resource.' )

  userAclEntry.role = roles.find( r => r.name === userAclEntry.role )

  if ( userAclEntry.role.weight >= role.weight )
    return userAclEntry.role.name
  else
    throw new ForbiddenError( 'You are not authorized.' )
}

module.exports = {
  contextApiTokenHelper,
  contextMiddleware,
  validateServerRole,
  validateScopes,
  authorizeResolver,
  pubsub
}
